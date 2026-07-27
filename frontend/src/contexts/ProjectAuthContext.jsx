import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

const ProjectAuthContext = createContext(null);

export function ProjectAuthProvider({ children }) {
  const [projectUser, setProjectUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () =>
    api.get('/project-auth/me')
      .then((res) => setProjectUser(res.data.data || null))
      .catch(() => setProjectUser(null))
      .finally(() => setLoading(false));

  useEffect(() => { refresh(); }, []);

  const logout = async () => {
    await api.post('/project-auth/logout').catch(() => {});
    setProjectUser(null);
  };

  return (
    <ProjectAuthContext.Provider value={{ projectUser, loading, logout, refresh: () => { setLoading(true); refresh(); } }}>
      {children}
    </ProjectAuthContext.Provider>
  );
}

export function useProjectAuth() {
  return useContext(ProjectAuthContext);
}
