import { GoogleGenAI, Type } from "@google/genai";
import type { R2Bucket, D1Database, Fetcher, ExecutionContext } from "@cloudflare/workers-types";

export interface Env {
  GEMINI_API_KEY: string;
  CAD_STORAGE: R2Bucket;
  PLATFORM_STORAGE: R2Bucket;
  SPLINEICONS_STORAGE: R2Bucket;
  DB: D1Database;
  ASSETS: Fetcher;
}

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

    if (request.method === 'GET' && url.pathname === '/api/theme') {
      try {
        const result = await env.DB.prepare('SELECT config FROM cms_themes WHERE is_system = 1 LIMIT 1').first();
        return new Response(JSON.stringify(result || {}), { headers: { 'Content-Type': 'application/json' } });
      } catch(e: any) {
        return new Response(JSON.stringify({error: e.message}), { status: 500, headers: { 'Content-Type': 'application/json' }});
      }
    }

    // Default to serving static assets
    return env.ASSETS.fetch(request as any);
  }
};

