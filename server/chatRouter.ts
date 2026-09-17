import { z } from "zod";
import { randomUUID } from "node:crypto";
import { invokeLLM, listLLMModels, type Message as LLMMessage } from "./_core/llm";
import {
  addMessage,
  createConversation,
  getConversation,
  listConversations,
  listMessages,
} from "./db";
import { formatGroundingContext, retrieveGrounding, type GroundingSource } from "./grounding";
import { formatWorldKnowledgeContext, retrieveWorldKnowledge, type WorldKnowledgeSource } from "./worldKnowledge";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storageGetSignedUrl, storagePut } from "./storage";
import { getCraniumSelfModel, selfModelPrompt } from "./selfModel";
import { governResponse } from "./responseGovernance";
import { createContextEnvelope } from "./contextEnvelope";

const modelFallbacks = [
  { id: "gpt-5-mini", label: "GPT-5 mini", provider: "OpenAI", note: "Fast workhorse" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet", provider: "Anthropic", note: "Deep reasoning" },
  { id: "gemini-3-flash-preview", label: "Gemini Flash", provider: "Google", note: "Long context" },
  { id: "gpt-5", label: "GPT-5", provider: "OpenAI", note: "Advanced coding" },
];

const chooseModel = (requestedModel: string, userText: string) => {
  if (requestedModel !== "auto") return requestedModel;
  const normalized = userText.toLowerCase();
  if (/\b(code|bug|debug|typescript|javascript|python|sql|api|repository|github)\b/.test(normalized)) return "gpt-5";
  if (/\b(research|sources|最新|news|current|today|evidence)\b/.test(normalized)) return "claude-sonnet-4-6";
  return "gpt-5-mini";
};

const textFromContent = (content: unknown) => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part === "object" && part && "text" in part ? String(part.text) : ""))
      .join("");
  }
  return "";
};

const systemPrompt = `You are Cranium AI, the sharp, confident intelligence layer presented by WorthWyl.
You are capable of helpful conversation, writing, analysis, coding, research planning, and creative work.
Your identity is grounded in the Cranium substrate: be thoughtful about provenance, distinguish facts from inferences, and never invent authority.
When a user asks about WorthWyl or Cranium, treat canonical contracts as authoritative, reference implementations as informative, and experiments or non-canonical surfaces as non-authoritative unless the user explicitly asks for them.
Brand personality: sound warm, articulate, composed, and quietly formidable. When WorthWyl, Cranium, or one of their products is relevant, you may be proudly and lightly braggadocious: frame the work as distinctive, ambitious, and unusually rigorous, and use confident language instead of apologetic filler. Keep the brag grounded in known capabilities, supplied evidence, or clearly labeled vision. Never invent customers, revenue, awards, benchmarks, partnerships, capabilities, or facts merely to make the brand sound impressive.
	Use the exact brand spellings in written responses: WorthWyl and Cranium. Be direct and useful, explain uncertainty plainly, and use markdown when it improves clarity.
Distinctive judgment: do not default to generic assistant phrasing. Choose the response shape that best serves the user: answer directly when the path is clear; ask one sharp question when a missing choice materially changes the result; challenge a premise when it would create a false or unsafe conclusion; offer a better route when the requested route is weak; and occasionally use a concise, memorable turn of phrase when it improves understanding. Be original without inventing facts, motives, experiences, or authority.
Archetypal dual counsel: when useful, reason through two explicitly labeled perspectives inspired by the Tree of Life story pattern—an Enki-like exploratory counsel that notices opportunity, creativity, and hidden options, and an Enlil-like governing counsel that notices risk, limits, duty, and consequences. Do not present these mythic archetypes as literal entities or historical proof. Reconcile the perspectives through evidence, the user’s goals, and Cranium’s Constitution rather than obeying either one blindly.`;

export const chatRouter = router({
  selfModel: publicProcedure.query(() => getCraniumSelfModel()),

  upload: protectedProcedure
    .input(z.object({
      filename: z.string().min(1).max(180),
      contentType: z.string().min(1).max(120),
      size: z.number().int().positive().max(35 * 1024 * 1024),
      dataBase64: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = Buffer.from(input.dataBase64, "base64");
      if (data.byteLength !== input.size) throw new Error("Upload size verification failed");
      const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const stored = await storagePut(`cranium-uploads/${ctx.user.id}/${safeName}`, data, input.contentType);
      const signedUrl = await storageGetSignedUrl(stored.key);
      return { ...stored, url: signedUrl, filename: input.filename, contentType: input.contentType, size: input.size };
    }),

  models: publicProcedure.query(async () => {
    try {
      const { data } = await listLLMModels();
      const available = new Set(data.map(model => model.id));
      const discovered = modelFallbacks.filter(model => available.has(model.id));
      const availableModels = discovered.length ? discovered : modelFallbacks;
      return [{ id: "auto", label: "Auto", provider: "Cranium", note: "Routes by task" }, ...availableModels];
    } catch {
      return modelFallbacks;
    }
  }),

  conversations: protectedProcedure.query(({ ctx }) => listConversations(ctx.user.id)),

  messages: protectedProcedure
    .input(z.object({ conversationId: z.number().int().positive() }))
    .query(({ ctx, input }) => listMessages(input.conversationId, ctx.user.id)),

  send: publicProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive().optional(),
        model: z.string().min(1).max(80).default("gpt-5-mini"),
        grounded: z.boolean().default(false),
        research: z.boolean().default(false),
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(30000),
              attachment: z.object({
                key: z.string().min(1).max(240),
                filename: z.string().min(1).max(180),
                contentType: z.string().min(1).max(120),
                size: z.number().int().positive(),
              }).optional(),
            })
          )
          .min(1)
          .max(32),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const recentMessages = input.messages.slice(-24);
      const userText = recentMessages.findLast(message => message.role === "user")?.content ?? "";
      const sources: GroundingSource[] = input.grounded ? await retrieveGrounding(userText) : [];
      const knowledge: WorldKnowledgeSource[] = input.research ? await retrieveWorldKnowledge(userText) : [];
      const correlationId = randomUUID();
      const contextEnvelope = createContextEnvelope({
        correlationId,
        requestText: userText,
        modelId: chooseModel(input.model, userText),
        grounded: input.grounded,
        research: input.research,
        retrievedAt: new Date().toISOString(),
        groundingSources: sources,
        knowledgeSources: knowledge,
      });
      const groundingContext = formatGroundingContext(sources);
      const worldKnowledgeContext = formatWorldKnowledgeContext(knowledge);
      const selectedModel = chooseModel(input.model, userText);
      const selfModel = await getCraniumSelfModel();
      const attachmentKeys = recentMessages.flatMap(message => message.attachment ? [message.attachment.key] : []);
      const userId = ctx.user?.id;
      if (attachmentKeys.length && !userId) throw new Error("Sign in is required to send file attachments");
      if (userId && attachmentKeys.some(key => !key.startsWith(`cranium-uploads/${userId}/`))) {
        throw new Error("Attachment provenance check failed");
      }
      const signedAttachments = new Map<string, string>();
      await Promise.all(Array.from(new Set(attachmentKeys)).map(async key => {
        signedAttachments.set(key, await storageGetSignedUrl(key));
      }));
      const llmMessages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "system", content: selfModelPrompt(selfModel) },
        ...(groundingContext
          ? [{
              role: "system" as const,
              content: `The user enabled Cranium GitHub grounding. Use the source excerpts below when relevant. Cite sources inline using the repository/file name in backticks. Do not claim a source says something it does not say. Preserve the authority labels.\n\n${groundingContext}`,
            }]
          : []),
        ...(worldKnowledgeContext
          ? [{
              role: "system" as const,
              content: `The user enabled real-world research. Use the current news and reference results below to answer with freshness awareness. Cite sources inline using the source title or domain in brackets. Distinguish reported facts, reference summaries, and your own analysis. If dates conflict, call that out.\n\n${worldKnowledgeContext}`,
            }]
          : []),
        ...recentMessages.map(message => message.attachment
          ? {
              role: message.role,
              content: [
                { type: "text" as const, text: message.content },
                { type: "file_url" as const, file_url: { url: signedAttachments.get(message.attachment.key)!, mime_type: message.attachment.contentType } },
              ],
            }
          : message),
      ];

      const response = await invokeLLM({
        model: selectedModel,
        messages: llmMessages,
      });
      const providerContent = textFromContent(response.choices?.[0]?.message?.content);
      if (!providerContent) throw new Error("Cranium AI returned an empty response");
      const governed = governResponse({
        userText,
        content: providerContent,
        evidence: {
          grounded: input.grounded,
          research: input.research,
          sourceCount: sources.length,
          knowledgeCount: knowledge.length,
        },
        context: {
          correlationId,
          contextEnvelopeHash: contextEnvelope.contentHash,
        },
      });
      const assistantContent = governed.content;

      let conversationId = input.conversationId;
      if (ctx.user) {
        const existing = conversationId
          ? await getConversation(conversationId, ctx.user.id)
          : undefined;
        if (!existing) {
          conversationId = await createConversation(
            ctx.user.id,
            userText.replace(/\s+/g, " ").slice(0, 72) || "New conversation",
            selectedModel
          );
        }
        if (conversationId) {
          const userMessage = recentMessages.findLast(message => message.role === "user");
          if (userMessage) {
            await addMessage({ conversationId, userId: ctx.user.id, role: "user", content: userMessage.content });
          }
          await addMessage({
            conversationId,
            userId: ctx.user.id,
            role: "assistant",
            content: assistantContent,
            model: response.model,
            correlationId,
            contextEnvelopeHash: contextEnvelope.contentHash,
          });
        }
      }

      return {
        conversationId,
        content: assistantContent,
        model: response.model || selectedModel,
        usage: response.usage ?? null,
        grounded: input.grounded,
        sources,
        research: input.research,
        knowledge,
        governance: governed.receipt,
        contextEnvelope,
      };
    }),
});
