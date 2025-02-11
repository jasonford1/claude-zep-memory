import Anthropic from "@anthropic-ai/sdk";
import { ZepClient } from "@getzep/zep-cloud";
import dotenv from "dotenv";

dotenv.config();

// For a single user setup - hardcoded user info
const CONSTANT_USER = {
	userId: "john.doe",
	email: "example@example.com",
	firstName: "John",
	lastName: "Doe"
};

const tools = [
	{
		name: "graph_add",
		description: "Add new information to your long-term memory. Use this whenever you learn something important about the user or context that should be remembered for future conversations.",
		input_schema: {
			type: "object",
			properties: {
				data: {
					type: "string",
					description: "The information to store (text or JSON string). For text/message types, include speaker and content. For JSON, include relevant structured data."
				},
				type: {
					type: "string",
					enum: ["text", "message", "json"],
					description: "Format of the data: 'text' for plain text, 'message' for conversational data, 'json' for structured data"
				}
			},
			required: ["data", "type"]
		}
	},
	{
		name: "graph_search",
		description: "Search your memory graph for any relevant information about a topic, person, or previous conversation. Use this to recall past interactions or stored knowledge.",
		input_schema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Natural language description of what you want to find in memory. Be specific about the information you're looking for."
				}
			},
			required: ["query"]
		}
	},
	{
		name: "get_edge",
		description: "Retrieve a specific relationship or fact from memory using its UUID. Use this when you need to get more details about a specific connection you've found through search.",
		input_schema: {
			type: "object",
			properties: {
				uuid: {
					type: "string",
					description: "The unique identifier of the edge (relationship/fact) you want to retrieve"
				}
			},
			required: ["uuid"]
		}
	},
	{
		name: "get_node",
		description: "Retrieve information about a specific entity (person, object, concept) from memory using its UUID. Use this when you need detailed information about something you've found through search.",
		input_schema: {
			type: "object",
			properties: {
				uuid: {
					type: "string",
					description: "The unique identifier of the node (entity) you want to retrieve"
				}
			},
			required: ["uuid"]
		}
	},
	{
		name: "get_user_edges",
		description: "Retrieve all known facts and relationships about Jason Ford. Use this to get a complete picture of what you know about the user.",
		input_schema: {
			type: "object",
			properties: {},
			description: "No input needed - automatically uses the current user's ID"
		}
	},
	{
		name: "get_user_nodes",
		description: "Retrieve all entities (people, objects, concepts) directly connected to Jason Ford in memory. Use this to understand what topics and entities are relevant to the user.",
		input_schema: {
			type: "object",
			properties: {},
			description: "No input needed - automatically uses the current user's ID"
		}
	},
	{
		name: "get_episodes",
		description: "Retrieve specific conversations or interactions with the user. Use this to recall detailed context from past conversations.",
		input_schema: {
			type: "object",
			properties: {
				lastN: {
					type: "number",
					description: "Optional: Number of most recent episodes to retrieve. Omit to get all episodes."
				}
			}
		}
	}
];

function getSessionId() {
	const now = new Date();
	return `session_${now.getTime()}`;
}

class ClaudeZepAgent {
	constructor() {
		this.anthropic = new Anthropic();
		this.zep = new ZepClient({ apiKey: process.env.ZEP_API_KEY });
		this.userId = CONSTANT_USER.userId;
		this.sessionId = getSessionId();
	}

	async initialize() {
		try {
			await this.zep.user.get(this.userId);
		} catch (error) {
			await this.zep.user.add({
				userId: this.userId,
				email: CONSTANT_USER.email,
				firstName: CONSTANT_USER.firstName,
				lastName: CONSTANT_USER.lastName
			});
		}

		try {
			await this.zep.memory.getSession(this.sessionId);
		} catch (error) {
			await this.zep.memory.addSession({
				sessionId: this.sessionId,
				userId: this.userId
			});
		}
	}

	async executeToolCall(toolCall) {
		console.log("Executing tool:", toolCall.name);
		try {
			let result;
			switch(toolCall.name) {
			case "graph_add":
				result = await this.zep.graph.add({
					userId: this.userId,
					type: toolCall.input.type,
					data: toolCall.input.data
				});
				break;
			case "graph_search":
				result = await this.zep.graph.search({
					userId: this.userId,
					query: toolCall.input.query
				});
				break;
			case "get_edge":
				result = await this.zep.graph.edge.get(toolCall.input.uuid);
				break;
			case "get_node":
				result = await this.zep.graph.node.get(toolCall.input.uuid);
				break;
			case "get_user_edges":
				result = await this.zep.graph.edge.getByUserId(this.userId);
				break;
			case "get_user_nodes":
				result = await this.zep.graph.node.getByUserId(this.userId);
				break;
			case "get_episodes":
				result = await this.zep.graph.episode.getByUserId(
					this.userId,
					toolCall.input.lastN ? { lastN: toolCall.input.lastN } : undefined
				);
				break;
			default:
				throw new Error(`Unknown tool: ${toolCall.name}`);
			}
			console.log("Tool result:", JSON.stringify(result, null, 2));
			return result;
		} catch (error) {
			console.error(`Error executing tool ${toolCall.name}:`, error);
			throw error;
		}
	}

	async chat(userMessage) {
		const memory = await this.zep.memory.get(this.sessionId);
		const systemMessage = `You are a helpful AI assistant with access to long-term memory via Zep. 
            Use your tools naturally when you need to check or store information.
            Here is relevant context from your memory:
            ${memory.context}`;

		let conversationMessages = [{
			role: "user",
			content: userMessage
		}];

		console.log("Sending request to Claude with messages:", JSON.stringify(conversationMessages, null, 2));

		let currentResponse = await this.anthropic.messages.create({
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1024,
			temperature: 0,
			tools: tools,
			system: systemMessage,
			messages: conversationMessages
		});

		console.log("Received response from Claude:", JSON.stringify(currentResponse, null, 2));

		let assistantResponse = "";
        
		// Process each response from Claude
		while (currentResponse.content.some(item => item.type === "tool_use")) {
			// Save the full response content (including both text and tool_use)
			conversationMessages.push({
				role: "assistant",
				content: currentResponse.content
			});

			// Process tool calls and collect results
			for (const item of currentResponse.content) {
				if (item.type === "text") {
					assistantResponse = item.text;
				}
				else if (item.type === "tool_use") {
					try {
						const toolResult = await this.executeToolCall(item);
                        
						// Add tool result
						conversationMessages.push({
							role: "user",
							content: [{
								type: "tool_result",
								tool_use_id: item.id,
								content: JSON.stringify(toolResult)
							}]
						});

						// Get new response with tool results
						currentResponse = await this.anthropic.messages.create({
							model: "claude-3-5-sonnet-20241022",
							max_tokens: 1024,
							temperature: 0,
							tools: tools,
							system: systemMessage,
							messages: conversationMessages
						});

						// Update assistant response if there's text content
						const textContent = currentResponse.content.find(c => c.type === "text");
						if (textContent) {
							assistantResponse = textContent.text;
						}
					} catch (error) {
						console.error("Tool use error:", error);
						console.error("Full error details:", JSON.stringify(error, null, 2));
						assistantResponse = "I encountered an issue while processing the information. Let me try a different approach.";
						break;
					}
				}
			}
		}

		// Store the final exchange in memory
		await this.zep.memory.add(this.sessionId, {
			messages: [
				{
					role: "user",
					roleType: "user",
					content: userMessage
				},
				{
					role: "assistant",
					roleType: "assistant",
					content: assistantResponse
				}
			],
			returnContext: true
		});

		return assistantResponse;
	}
}

// Simple CLI interface
async function main() {
	const agent = new ClaudeZepAgent();
	await agent.initialize();
    
	console.log("Claude initialized with memory capabilities. Type 'exit' to quit.");
    
	const readline = (await import("readline")).createInterface({
		input: process.stdin,
		output: process.stdout
	});

	readline.setPrompt("You: ");
	readline.prompt();

	readline.on("line", async (input) => {
		if (input.toLowerCase() === "exit") {
			readline.close();
			return;
		}

		try {
			const response = await agent.chat(input);
			console.log("\nClaude:", response);
		} catch (error) {
			console.error("Error:", error.message);
		}

		readline.prompt();
	});
}

main().catch(console.error);
