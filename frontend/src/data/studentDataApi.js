// API functions for student data (bank connections, variable symbols, device sessions)
import api from '../utils/apiClient';

// ==================== Bank Connections ====================

export async function fetchBankConnections(studentId) {
    try {
        const res = await api.get(`/students/${studentId}/bank-connections`);
        return Array.isArray(res) ? res : [];
    } catch {
        return [];
    }
}

export async function addBankConnection(studentId, data) {
    try {
        const res = await api.post(`/students/${studentId}/bank-connections`, data);
        return res;
    } catch {
        return null;
    }
}

export async function updateBankConnection(studentId, connectionId, data) {
    try {
        const res = await api.put(`/students/${studentId}/bank-connections/${connectionId}`, data);
        return res;
    } catch {
        return null;
    }
}

export async function deleteBankConnection(studentId, connectionId) {
    try {
        const res = await api.del(`/students/${studentId}/bank-connections/${connectionId}`);
        return res;
    } catch {
        return null;
    }
}

// ==================== Variable Symbols ====================

export async function fetchVariableSymbols(studentId) {
    try {
        const res = await api.get(`/students/${studentId}/variable-symbols`);
        return Array.isArray(res) ? res : [];
    } catch {
        return [];
    }
}

export async function addVariableSymbol(studentId, data) {
    try {
        const res = await api.post(`/students/${studentId}/variable-symbols`, data);
        return res;
    } catch {
        return null;
    }
}

export async function updateVariableSymbol(studentId, symbolId, data) {
    try {
        const res = await api.put(`/students/${studentId}/variable-symbols/${symbolId}`, data);
        return res;
    } catch {
        return null;
    }
}

export async function deleteVariableSymbol(studentId, symbolId) {
    try {
        const res = await api.del(`/students/${studentId}/variable-symbols/${symbolId}`);
        return res;
    } catch {
        return null;
    }
}

// ==================== Device Sessions ====================

export async function fetchDeviceSessions(userId) {
    try {
        const res = await api.get(`/students/sessions/${userId}`);
        return Array.isArray(res) ? res : [];
    } catch {
        return [];
    }
}

export async function createDeviceSession(data) {
    try {
        const res = await api.post(`/students/sessions`, data);
        return res;
    } catch {
        return null;
    }
}

export async function updateSessionActivity(sessionId) {
    try {
        const res = await api.put(`/students/sessions/${sessionId}/activity`, {});
        return res;
    } catch {
        return null;
    }
}

export async function deleteDeviceSession(sessionId) {
    try {
        const res = await api.del(`/students/sessions/${sessionId}`);
        return res;
    } catch {
        return null;
    }
}
