const API_URL = 'http://localhost:3000';

export const api = {
  auth: {
    signup: async (headers: any) => {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { ...headers }
      });
      return response.json();
    },
    signin: async (headers: any) => {
      const response = await fetch(`${API_URL}/auth/signin`, {
        method: 'POST',
        headers: { ...headers }
      });
      return response.json();
    },
  },
  interview: {
    start: async (domain: string, username: string, jobDescriptionId?: string) => {
      const response = await fetch(`${API_URL}/api/interview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'username': username
        },
        body: JSON.stringify({ domain, jobDescriptionId })
      });
      return response.json();
    },
    addAnswer: async (answer: string, username: string) => {
      const response = await fetch(`${API_URL}/api/addanswer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'username': username
        },
        body: JSON.stringify({ answer })
      });
      return response.json();
    },
    getScore: async (username: string) => {
      const response = await fetch(`${API_URL}/api/score`, {
        method: 'POST',
        headers: { 'username': username }
      });
      return response.json();
    },
    checkResume: async (resume: string, profile: string, token: string) => {
      const response = await fetch(`${API_URL}/api/checkresume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'jwttoken': token
        },
        body: JSON.stringify({ resume, profile })
      });
      return response.json();
    }
  },
  rag: {
    ingestJD: async (title: string, rawText: string, token: string, company?: string) => {
      const response = await fetch(`${API_URL}/api/rag/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'jwttoken': token
        },
        body: JSON.stringify({ title, company, rawText })
      });
      return response.json();
    },
    listJDs: async (token: string) => {
      const response = await fetch(`${API_URL}/api/rag/job-descriptions`, {
        method: 'GET',
        headers: { 'jwttoken': token }
      });
      return response.json();
    },
    deleteJD: async (id: string, token: string) => {
      const response = await fetch(`${API_URL}/api/rag/job-descriptions/${id}`, {
        method: 'DELETE',
        headers: { 'jwttoken': token }
      });
      return response.json();
    },
    gapAnalysis: async (resumeText: string, token: string) => {
      const response = await fetch(`${API_URL}/api/rag/gap-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'jwttoken': token
        },
        body: JSON.stringify({ resumeText })
      });
      return response.json();
    }
  }
};

