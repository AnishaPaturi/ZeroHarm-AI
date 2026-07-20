import { fetchBackend } from './api';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: { id: string; title: string; source: string; score: number }[];
  mode?: string;
}

export const chatbotService = {
  sendMessage: async (message: string): Promise<{ answer: string; sources?: any[]; mode?: string }> => {
    try {
      const data = await fetchBackend<{ answer: string; sources: any[]; mode: string }>('/api/rag/query', {
        method: 'POST',
        body: JSON.stringify({ query: message }),
      });
      return { answer: data.answer, sources: data.sources, mode: data.mode };
    } catch (error) {
      console.error('Error in chatbot service:', error);
      return {
        answer: `### ❌ RAG Search Connection Failure\n\nCould not connect to the ZeroHarm RAG audit engine on the backend. Please check if your FastAPI server is running on port 8000.\n\n*Error Details: ${error instanceof Error ? error.message : String(error)}*`,
        mode: 'Connection Failed'
      };
    }
  }
};
