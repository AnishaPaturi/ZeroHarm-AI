import { fetchBackend } from './api';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const chatbotService = {
  sendMessage: async (message: string): Promise<string> => {
    try {
      const data = await fetchBackend<{ answer: string; sources: any[] }>('/api/rag/query', {
        method: 'POST',
        body: JSON.stringify({ query: message }),
      });
      return data.answer;
    } catch (error) {
      console.error('Error in chatbot service:', error);
      return `### ❌ RAG Search Connection Failure

Could not connect to the ZeroHarm RAG audit engine on the backend. Please check if your FastAPI server is running on port 8000.

*Error Details: ${error instanceof Error ? error.message : String(error)}*`;
    }
  }
};
