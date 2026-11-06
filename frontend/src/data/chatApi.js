import apiClient from '../utils/apiClient';

const base = '/chat';

const chatApi = {
  async listThreads(signal) {
    return apiClient.get(`${base}/threads`, { signal });
  },
  async getThread(threadId, signal) {
    return apiClient.get(`${base}/threads/${encodeURIComponent(threadId)}`, { signal });
  },
  async createThread(payload, signal) {
    return apiClient.post(`${base}/threads`, payload, { signal });
  },
  async updateThread(threadId, payload, signal) {
    return apiClient.patch(`${base}/threads/${encodeURIComponent(threadId)}`, payload, { signal });
  },
  async deleteThread(threadId, signal) {
    return apiClient.delete(`${base}/threads/${encodeURIComponent(threadId)}`, { signal });
  },
  async clearThread(threadId, signal) {
    return apiClient.post(`${base}/threads/${encodeURIComponent(threadId)}/clear`, {}, { signal });
  },
  async sendMessage(threadId, payload, signal) {
    return apiClient.post(`${base}/threads/${encodeURIComponent(threadId)}/messages`, payload, { signal });
  },
  async updateMessage(threadId, messageId, payload, signal) {
    return apiClient.patch(`${base}/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}`, payload, { signal });
  },
  async deleteMessage(threadId, messageId, signal) {
    return apiClient.delete(`${base}/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}`, { signal });
  },
  async toggleReaction(threadId, messageId, payload, signal) {
    return apiClient.post(`${base}/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/reactions`, payload, { signal });
  },
  async markRead(threadId, payload, signal) {
    return apiClient.post(`${base}/threads/${encodeURIComponent(threadId)}/reads`, payload, { signal });
  },
  async pinThread(threadId, payload, signal) {
    return apiClient.post(`${base}/threads/${encodeURIComponent(threadId)}/pin`, payload, { signal });
  },
  async getAiSettings(threadId, signal) {
    return apiClient.get(`${base}/threads/${encodeURIComponent(threadId)}/ai/settings`, { signal });
  },
  async updateAiSettings(threadId, payload, signal) {
    return apiClient.put(`${base}/threads/${encodeURIComponent(threadId)}/ai/settings`, payload, { signal });
  },
  async uploadAttachment(threadId, file, signal) {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post(`${base}/threads/${encodeURIComponent(threadId)}/attachments`, form, { signal });
  }
};

export default chatApi;

