/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { useCallback, useEffect, useState } from 'react';
import { API } from '../../helpers';

export const useLoginSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revokingSid, setRevokingSid] = useState('');
  const [revokingOthers, setRevokingOthers] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/api/user/sessions');
      const { success, message, data } = res.data;
      if (success) {
        setSessions(Array.isArray(data) ? data : []);
      } else {
        setSessions([]);
        setError(message || '');
      }
    } catch (e) {
      setSessions([]);
      setError(e?.response?.data?.message || e?.message || '');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const revokeSession = useCallback(
    async (sid) => {
      if (!sid) {
        return { success: false, message: '' };
      }
      setRevokingSid(sid);
      try {
        const res = await API.delete(
          `/api/user/sessions/${encodeURIComponent(sid)}`,
        );
        const { success, message, data } = res.data;
        if (success && !data?.current) {
          await refresh();
        }
        return { success, message, current: Boolean(data?.current) };
      } catch (e) {
        return {
          success: false,
          message: e?.response?.data?.message || e?.message || '',
        };
      } finally {
        setRevokingSid('');
      }
    },
    [refresh],
  );

  const revokeOthers = useCallback(async () => {
    setRevokingOthers(true);
    try {
      const res = await API.post('/api/user/sessions/revoke-others');
      const { success, message } = res.data;
      if (success) {
        await refresh();
      }
      return { success, message };
    } catch (e) {
      return {
        success: false,
        message: e?.response?.data?.message || e?.message || '',
      };
    } finally {
      setRevokingOthers(false);
    }
  }, [refresh]);

  return {
    sessions,
    loading,
    error,
    refresh,
    revokeSession,
    revokeOthers,
    revokingSid,
    revokingOthers,
  };
};
