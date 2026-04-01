import { GoogleGenAI, Type } from "@google/genai";
import type { R2Bucket, D1Database, Fetcher, ExecutionContext, DurableObjectNamespace } from "@cloudflare/workers-types";
import { MeauxCADSession } from "./src/MeauxCADSession";
import { SHELL_VERSION } from "./src/shellVersion";

export interface Env {
  GEMINI_API_KEY: string;
  CAD_STORAGE: R2Bucket;
  PLATFORM_STORAGE: R2Bucket;
  SPLINEICONS_STORAGE: R2Bucket;
  DB: D1Database;
  ASSETS: Fetcher;
  MCAD_SESSION: DurableObjectNamespace;
  INTERNAL_API_SECRET: string;
  MCP_AUTH_TOKEN: string;
}

const VERSION = SHELL_VERSION;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/generate') {
      try {
        const body = await request.json() as { prompt: string };
        const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: body.prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                  position: {
                      type: Type.OBJECT,
                      properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, z: { type: Type.NUMBER } }
                  },
                  behavior: {
                      type: Type.OBJECT,
                      properties: { 
                        type: { type: Type.STRING }, 
                        speed: { type: Type.NUMBER },
                        mass: { type: Type.NUMBER },
                        restitution: { type: Type.NUMBER },
                        friction: { type: Type.NUMBER }
                      }
                  },
                  voxels: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        x: { type: Type.INTEGER }, y: { type: Type.INTEGER }, z: { type: Type.INTEGER }, color: { type: Type.STRING }
                      }
                    }
                  }
                },
                required: ["id", "name", "type", "voxels", "position", "behavior"]
              }
            }
          }
        });

        return new Response(JSON.stringify({ text: response.text }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/chat') {
      try {
        const body = await request.json() as { messages: any[], contextMode: string, contextCode?: string };
        const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        
        let systemPrompt = `You are the Meaaux Studio Assistant, an IDE-embedded AI specialized in Web Development, 3D Voxel Engine engineering, and React code generation.\nCurrent Studio Mode: ${body.contextMode}\n`;
        
        if (body.contextCode) {
            systemPrompt += `\n\nTHE USER IS CURRENTLY VIEWING THIS FILE IN THEIR MONACO EDITOR:\n\`\`\`\n${body.contextCode}\n\`\`\`\nAnswer their questions with this code context in mind constraints unless they change topics.`;
        }

        // Map messages to Gemini's format
        const history = body.messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));
        
        // Isolate the final message as the prompt, remainder as history
        const promptMsg = history.pop();
        
        const chat = ai.chats.create({
            model: 'gemini-3-flash-preview',
            config: { systemInstruction: systemPrompt },
            history: history
        });

        const resultStream = await chat.sendMessageStream({ message: promptMsg!.parts[0].text });

        return new Response(new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of resultStream) {
                        const data = { text: chunk.text };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    }
                    controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                } catch (e: any) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
                } finally {
                    controller.close();
                }
            }
        }), {
          headers: { 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/cad/upload/')) {
      const id = url.pathname.split('/').pop()!;
      try {
          const body = await request.text();
          await env.CAD_STORAGE.put(id, body);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' }});
      } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' }});
      }
    }
  
    if (request.method === 'GET' && url.pathname.startsWith('/api/cad/get/')) {
        const id = url.pathname.split('/').pop()!;
        try {
            const object = await env.CAD_STORAGE.get(id);
            if (!object) return new Response('Not found', { status: 404 });
            const headers = new Headers();
            object.writeHttpMetadata(headers as any);
            headers.set('etag', object.httpEtag);
            return new Response(object.body as any, { headers });
        } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (request.method === 'GET' && url.pathname === '/api/models') {
      try {
        // Return structured elite model list with multimodal caps
        const eliteModels = [
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Elite)', type: 'LLM', status: 100 },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)', type: 'LLM', status: 90 },
          { id: 'imagen-3', name: 'Imagen-3 (Creative)', type: 'IMAGE', status: 80 },
          { id: 'dall-e-3', name: 'Dall-E 3 (Art)', type: 'IMAGE', status: 70 }
        ];
        return new Response(JSON.stringify(eliteModels), { headers: { 'Content-Type': 'application/json' } });
      } catch(e: any) {
        return new Response(JSON.stringify({error: e.message}), { status: 500, headers: { 'Content-Type': 'application/json' }});
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/mcps') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT id, tool_name, tool_category, description, enabled, requires_approval, mcp_service_url, input_schema FROM mcp_registered_tools ORDER BY tool_category, tool_name LIMIT 100'
        ).all();
        return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
      } catch(e: any) {
        return new Response(JSON.stringify({error: e.message}), { status: 500, headers: { 'Content-Type': 'application/json' }});
      }
    }

    // ── Settings: MCPs ──────────────────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/api/settings/mcps') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT id, tool_name, tool_category, description, enabled, requires_approval, mcp_service_url, input_schema FROM mcp_registered_tools ORDER BY tool_category, tool_name'
        ).all();
        return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
      } catch(e: any) {
        return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' }});
      }
    }

    // ── Settings: Toggle MCP enabled ────────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/api/settings/mcps/toggle') {
      try {
        const { id, enabled } = await request.json() as { id: string; enabled: number };
        await env.DB.prepare('UPDATE mcp_registered_tools SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(enabled, id).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch(e: any) {
        return new Response(JSON.stringify({error: e.message}), { status: 500, headers: { 'Content-Type': 'application/json' }});
      }
    }

    // ── Settings: AI Models ─────────────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/api/settings/models') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT provider, model_key, display_name, is_active, supports_tools, supports_vision, size_class FROM ai_models ORDER BY provider, display_name'
        ).all();
        return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
      } catch(e: any) {
        return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' }});
      }
    }

    // ── Settings: GitHub Repos ──────────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/api/settings/repos') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT id, repo_full_name, repo_url, default_branch, cloudflare_worker_name, is_active FROM github_repositories ORDER BY repo_full_name'
        ).all();
        return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
      } catch(e: any) {
        return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' }});
      }
    }

    // ── Deploy Log: workspaces + worker_registry + r2_object_inventory ──────────
    if (request.method === 'POST' && url.pathname === '/api/deploy-log') {
      try {
        const { version, worker_name, r2_objects } = await request.json() as {
          version: string; worker_name: string; r2_objects?: { bucket_name: string; object_key: string; size_bytes: number; content_type: string }[]
        };
        const now = new Date().toISOString();

        // 1. workspaces — upsert MeauxCAD entry
        await env.DB.prepare(`
          INSERT INTO workspaces (id, name, domain, category, status, created_at, updated_at)
          VALUES ('meauxcad', 'MeauxCAD Studio', 'meauxcad.meauxbility.workers.dev', 'ide', 'active', ?, ?)
          ON CONFLICT(id) DO UPDATE SET status='active', updated_at=excluded.updated_at
        `).bind(now, now).run().catch(() => {});

        // 2. worker_registry — upsert deployment
        await env.DB.prepare(`
          INSERT INTO worker_registry (worker_name, worker_type, deployment_status, last_deployment, git_repo, last_commit_message, updated_at)
          VALUES (?, 'production', 'active', ?, 'inneranimalmedia---meaux-games---meauxcad', ?, ?)
          ON CONFLICT(worker_name) DO UPDATE SET deployment_status='active', last_deployment=excluded.last_deployment, last_commit_message=excluded.last_commit_message, updated_at=excluded.updated_at
        `).bind(worker_name, Date.now(), `deploy ${version}`, now).run().catch(() => {});

        // 3. r2_object_inventory — log new objects
        if (Array.isArray(r2_objects)) {
          for (const obj of r2_objects) {
            await env.DB.prepare(`
              INSERT INTO r2_object_inventory (bucket_name, object_key, size_bytes, content_type, last_modified_iso, inventoried_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(bucket_name, object_key) DO UPDATE SET size_bytes=excluded.size_bytes, last_modified_iso=excluded.last_modified_iso, inventoried_at=excluded.inventoried_at
            `).bind(obj.bucket_name, obj.object_key, obj.size_bytes, obj.content_type, now, now).run().catch(() => {});
          }
        }

        return new Response(JSON.stringify({ ok: true, logged_at: now }), { headers: { 'Content-Type': 'application/json' } });
      } catch(e: any) {
        return new Response(JSON.stringify({error: e.message}), { status: 500, headers: { 'Content-Type': 'application/json' }});
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/version') {
      return new Response(JSON.stringify({ version: VERSION, deployed_at: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── Database Explorer: D1 Inspection ────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/api/db/tables') {
      try {
        const { results } = await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
        ).all();
        return new Response(JSON.stringify({ success: true, tables: results.map((r: any) => r.name) }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/db/query') {
      try {
        const { sql, params } = await request.json() as { sql: string; params?: any[] };
        const stmt = env.DB.prepare(sql);
        const { results, meta } = await (params ? stmt.bind(...params) : stmt).all();
        return new Response(JSON.stringify({ success: true, results, meta }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/db/schema/')) {
      const table = url.pathname.split('/').pop()!;
      try {
        const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
        return new Response(JSON.stringify({ success: true, columns: results }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // ── Google Drive Proxy Stub ────────────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/api/drive/proxy') {
      try {
        // This is a placeholder for real OAuth-signed requests
        const { method, path, body } = await request.json() as { method: string; path: string; body: any };
        return new Response(JSON.stringify({ success: true, note: "Drive Proxy Active (Stub)", path }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // ── Playwright Job Management ──────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/api/playwright/jobs') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT id, job_type, target_url, status, result_url, error, created_at, completed_at, metadata FROM playwright_jobs ORDER BY created_at DESC LIMIT 100'
        ).all();
        return new Response(JSON.stringify({ success: true, jobs: results }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/playwright/jobs/launch') {
      try {
        const { job_type, target_url, metadata } = await request.json() as { job_type: string; target_url: string; metadata?: any };
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        
        await env.DB.prepare(`
          INSERT INTO playwright_jobs (id, job_type, target_url, status, created_at, metadata)
          VALUES (?, ?, ?, 'pending', ?, ?)
        `).bind(id, job_type || 'screenshot', target_url, now, JSON.stringify(metadata || {})).run();

        return new Response(JSON.stringify({ success: true, job_id: id }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/theme') {
      try {
        const result = await env.DB.prepare('SELECT config FROM cms_themes WHERE is_system = 1 LIMIT 1').first();
        return new Response(JSON.stringify(result || {}), { headers: { 'Content-Type': 'application/json' } });
      } catch(e: any) {
        return new Response(JSON.stringify({error: e.message}), { status: 500, headers: { 'Content-Type': 'application/json' }});
      }
    }

    // ── Task 2: Session Durable Object Routes ───────────────────────────────────
    if (request.method === 'GET' && url.pathname.startsWith('/api/session/')) {
      const workspaceId = url.pathname.split('/')[3];
      const id = env.MCAD_SESSION.idFromName(workspaceId);
      const stub = env.MCAD_SESSION.get(id);
      return stub.fetch(new Request('https://do/get'));
    }

    if (request.method === 'POST' && url.pathname.match(/^\/api\/session\/[^/]+\/canvas$/)) {
      const workspaceId = url.pathname.split('/')[3];
      const id = env.MCAD_SESSION.idFromName(workspaceId);
      const stub = env.MCAD_SESSION.get(id);
      return stub.fetch(new Request('https://do/canvas', { method: 'POST', body: request.body }));
    }

    if (request.method === 'POST' && url.pathname.match(/^\/api\/session\/[^/]+\/theme$/)) {
      const workspaceId = url.pathname.split('/')[3];
      const id = env.MCAD_SESSION.idFromName(workspaceId);
      const stub = env.MCAD_SESSION.get(id);
      return stub.fetch(new Request('https://do/theme', { method: 'POST', body: request.body }));
    }

    // ── Task 4: Theme Routes ───────────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/api/themes') {
      try {
        const { results } = await env.DB.prepare(
          `SELECT id, name, slug, config, preview_color FROM cms_themes WHERE is_active = 1 ORDER BY name`
        ).all();
        return new Response(JSON.stringify({ success: true, data: results }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/themes/active') {
      const workspaceId = url.searchParams.get('workspace') ?? 'meauxcad';
      try {
        const wsTheme = await env.DB.prepare(
          `SELECT theme_id FROM workspace_settings WHERE workspace_id = ? LIMIT 1`
        ).first<{ theme_id: string }>();

        const id = wsTheme?.theme_id ?? null;
        const query = id
          ? `SELECT config FROM cms_themes WHERE id = ? LIMIT 1`
          : `SELECT config FROM cms_themes WHERE is_system = 1 LIMIT 1`;
        const theme = await env.DB.prepare(query).bind(...(id ? [id] : [])).first<{ config: string }>();
        const cssVars = theme?.config ? JSON.parse(theme.config) : {};
        return new Response(JSON.stringify({ success: true, data: cssVars }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/themes/apply') {
      try {
        const { slug, theme_id, workspace_id } = await request.json() as { slug: string; theme_id: string; workspace_id: string };
        await env.DB.prepare(
          `INSERT INTO workspace_settings (workspace_id, theme_id, updated_at)
           VALUES (?, ?, unixepoch())
           ON CONFLICT(workspace_id) DO UPDATE SET theme_id = excluded.theme_id, updated_at = excluded.updated_at`
        ).bind(workspace_id ?? 'meauxcad', theme_id).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // ── Task 5: MCP Proxy ──────────────────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/api/mcp/invoke') {
      try {
        const body = await request.json();
        const resp = await fetch('https://mcp.inneranimalmedia.com/mcp', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.MCP_AUTH_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        const data = await resp.json();
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // Default to serving static assets
    return env.ASSETS.fetch(request as any);
  }
};

export { MeauxCADSession };

