# Claude-Zep Memory Agent

A Node.js application that combines Claude's conversational AI capabilities with Zep's long-term memory storage to create an AI assistant that can remember and reference past interactions.

## Features

- Long-term memory storage and retrieval using Zep
- Conversational AI powered by Claude 3.5 Sonnet
- Tools for managing memory operations:
  - Adding new information to memory
  - Searching memory for relevant information
  - Retrieving specific facts and relationships
  - Managing user-specific memory contexts
- Interactive CLI interface

## Prerequisites

- Node.js (version 14 or higher)
- Anthropic API key
- Zep API key

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the project root with your API keys:
```
ANTHROPIC_API_KEY=your_anthropic_api_key
ZEP_API_KEY=your_zep_api_key
```

## Usage

Start the application:
```bash
npm start
```

This will launch an interactive CLI where you can chat with the AI assistant. Type 'exit' to quit the application. The app communicates every move in the CLI so you will see all the background activity on your screen. This is to help debug and also to give you an understanding of what is happening under the hood.

## How It Works

The application consists of a `ClaudeZepAgent` class that:

1. Initializes connections to both Claude and Zep APIs
2. Manages a session-based conversation context
3. Processes user input through Claude
4. Executes memory-related operations using Zep
5. Maintains conversation history and context

The agent uses several tools to interact with memory:
- `graph_add`: Stores new information
- `graph_search`: Searches existing memory
- `get_edge`: Retrieves specific relationships
- `get_node`: Retrieves specific entities
- `get_user_edges`: Gets all user-related facts
- `get_user_nodes`: Gets all user-related entities
- `get_episodes`: Retrieves past conversations

## Dependencies

- `@anthropic-ai/sdk`: Anthropic's Claude API client
- `@getzep/zep-cloud`: Zep Cloud API client
- `dotenv`: Environment variable management

## Configuration

The application uses a constant user configuration for demonstration purposes. In a production environment, you would want to implement proper user management.

Current user configuration:
```javascript
{
    userId: "john.doe",
    email: "example@example.com",
    firstName: "John",
    lastName: "Doe"
}
```

## License

None

## Contributing

Feel free to use, fork, modify, and do anything you want. I'm here to help make AI easier to implement for all of us.
