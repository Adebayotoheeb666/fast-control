/* Local IndexedDB adaptor with remote fallback */
import Dexie from 'dexie';
import { Notification } from '@arco-design/web-react';
import { nanoid } from 'nanoid';
import { SERVER_URL } from '../../config';

const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
export const db = isBrowser ? new Dexie('graphDB') : null;

if (db) {
  // Upgrade schema to include applications, forms, and queries
  db.version(5).stores({
    graphs: 'id, createdAt, updatedAt',
    logs: '++id, graphId',
    applications: 'id, createdAt, updatedAt',
    forms: 'id, appId, createdAt, updatedAt',
    queries: 'id, appId, createdAt, updatedAt',
  });
}

const nowTs = () => new Date().valueOf();

const safeJson = async res => {
  try {
    return await res.json();
  } catch (_) {
    return null;
  }
};

const runRemote = async (fn, onErrorTitle) => {
  try {
    return await fn();
  } catch (e) {
    console.log(e);
    if (onErrorTitle) {
      Notification.error({ title: onErrorTitle });
    }
    return null;
  }
};

/* Graphs */
export const getAllGraphs = async () => {
  const remote = await runRemote(async () => {
    const res = await fetch(`${SERVER_URL}/backend/index.php/api/getAllGraphs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await safeJson(res);
    if (!data?.allGraphsData) return null;
    return data.allGraphsData.map(item => ({ ...JSON.parse(item?.graph).graphJSON, id: item.id }));
  }, 'Server Connection Error');
  if (remote) return remote;
  return db ? await db.graphs.toArray() : [];
};

export const getGraph = async id => {
  const remote = await runRemote(async () => {
    const res = await fetch(`${SERVER_URL}/backend/index.php/api/getGraph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await safeJson(res);
    const graph = JSON.parse(data?.graphData?.graph || '{}').graphJSON;
    return graph || null;
  }, 'Server Connection Error');
  if (remote) return remote;
  return db ? await db.graphs.get(id) : null;
};

export const saveGraph = async ({ id, name, tableDict, linkDict, box, connectConfig }) => {
  const updated = { id, name, tableDict, linkDict, box, connectConfig, updatedAt: nowTs() };
  const ok = await runRemote(async () => {
    const current = await getGraph(id);
    const graphJSON = { ...current, ...updated, createdAt: current?.createdAt };
    await fetch(`${SERVER_URL}/backend/index.php/api/saveGraph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, graphJSON }),
    });
    Notification.success({ title: 'Save success' });
    return true;
  });
  if (ok) return;
  if (!db) return;
  const existing = await db.graphs.get(id);
  await db.graphs.put({
    ...(existing || {}),
    ...updated,
    createdAt: existing?.createdAt ?? nowTs(),
  });
  Notification.success({ title: 'Save success (local)' });
};

export const delGraph = async id => {
  const ok = await runRemote(async () => {
    await fetch(`${SERVER_URL}/backend/index.php/api/deleteGraph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    Notification.success({ title: 'Delete success' });
    return true;
  }, 'Delete failed');
  if (ok) return;
  if (!db) return;
  await db.graphs.delete(id);
  Notification.success({ title: 'Delete success (local)' });
};

export const deleteAllGraphs = async () => {
  const ok = await runRemote(async () => {
    await fetch(`${SERVER_URL}/backend/index.php/api/deleteAllGraphs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    Notification.success({ title: 'Delete success' });
    return true;
  }, 'Delete failed');
  if (ok) return;
  if (!db) return;
  await db.graphs.clear();
  Notification.success({ title: 'Delete success (local)' });
};

export const addGraph = async (graph = {}, id = null) => {
  const ts = nowTs();
  const width = isBrowser ? window.innerWidth : 1366;
  const height = isBrowser ? window.innerHeight : 768;
  const graphJSON = {
    ...graph,
    box: { x: 0, y: 0, w: width, h: height, clientW: width, clientH: height },
    connectConfig: { hostname: 'localhost', username: 'root', password: '', database: 'graph_database' },
    createdAt: ts,
    updatedAt: ts,
  };
  const remoteId = await runRemote(async () => {
    const res = await fetch(`${SERVER_URL}/backend/index.php/api/addGraph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graphJSON }),
    });
    const data = await safeJson(res);
    Notification.success({ title: 'Add Success' });
    return data?.graphID || null;
  }, 'Add Failed');
  if (remoteId) return remoteId;
  if (!db) return null;
  const graphId = id || nanoid();
  await db.graphs.add({ id: graphId, ...graphJSON });
  Notification.success({ title: 'Add Success (local)' });
  return graphId;
};

export const getLogs = async id => (db ? await db.logs.where('graphId').equals(id).desc().toArray() : []);
export const delLogs = id => (db ? db.logs.delete(id) : undefined);

/* Applications */
export const getAllApplications = async () => {
  const remote = await runRemote(async () => {
    const res = await fetch(`${SERVER_URL}/backend/index.php/api/getAllApplications`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await safeJson(res);
    return (
      data?.allApplications?.map(_app => ({ ...(JSON.parse(_app?.application || '{}').appJSON || {}), id: _app?.id || '_' })) || []
    );
  }, 'Server Connection Error');
  if (remote) return remote;
  return db ? await db.applications.toArray() : [];
};

export const getApplication = async id => {
  const remote = await runRemote(async () => {
    const res = await fetch(`${SERVER_URL}/backend/index.php/api/getApplication`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await safeJson(res);
    return { ...(JSON.parse(data?.applicationData?.application || '{}').appJSON || {}), id: data?.applicationData?.id || '_' };
  }, 'Server Connection Error');
  if (remote) return remote;
  return db ? await db.applications.get(id) : null;
};

export const saveApplication = async (utilData = {}, appId = null) => {
  const ts = nowTs();
  const ok = await runRemote(async () => {
    const data = await getApplication(appId);
    const appJSON = { ...data, updatedAt: ts, createdAt: data?.createdAt, ...utilData };
    await fetch(`${SERVER_URL}/backend/index.php/api/saveApplication`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appId, appJSON }),
    });
    Notification.success({ title: 'Save success' });
    return true;
  }, 'Save failed');
  if (ok) return;
  if (!db) return;
  const existing = await db.applications.get(appId);
  await db.applications.put({ ...(existing || {}), ...(utilData || {}), id: appId, updatedAt: ts, createdAt: existing?.createdAt ?? ts });
  Notification.success({ title: 'Save success (local)' });
};

export const delApplication = async id => {
  const ok = await runRemote(async () => {
    await fetch(`${SERVER_URL}/backend/index.php/api/deleteApplication`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    Notification.success({ title: 'Delete success' });
    return true;
  }, 'Delete failed');
  if (ok) return;
  if (!db) return;
  await db.applications.delete(id);
  Notification.success({ title: 'Delete success (local)' });
};

export const deleteAllApplications = async () => {
  const ok = await runRemote(async () => {
    await fetch(`${SERVER_URL}/backend/index.php/api/deleteAllApplications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    Notification.success({ title: 'Delete success' });
    return true;
  }, 'Delete failed');
  if (ok) return;
  if (!db) return;
  await db.applications.clear();
  Notification.success({ title: 'Delete success (local)' });
};

export const addApplication = async (utilData = {}, id = null) => {
  const ts = nowTs();
  const appJSON = {
    connectionConfig: { hostname: 'localhost', username: 'root', password: '', database: '', database_id: null },
    forms: [],
    queries: [],
    createdAt: ts,
    updatedAt: ts,
    ...utilData,
  };
  const remoteId = await runRemote(async () => {
    const res = await fetch(`${SERVER_URL}/backend/index.php/api/addApplication`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appJSON }),
    });
    const data = await safeJson(res);
    Notification.success({ title: 'Add Success' });
    return data?.appId || null;
  }, 'Add Failed');
  if (remoteId) return remoteId;
  if (!db) return null;
  const appId = id || nanoid();
  await db.applications.add({ id: appId, ...appJSON });
  Notification.success({ title: 'Add Success (local)' });
  return appId;
};

/* Forms */
export const getAllForms = async () => {
  const remote = await runRemote(async () => {
    const res = await fetch(`${SERVER_URL}/backend/index.php/api/getAllForms`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await safeJson(res);
    return (
      data?.allForms?.map(_form => ({ ...(JSON.parse(_form.form || '{}')?.formJSON || {}), id: _form.id })) || []
    );
  }, 'Server Connection Error');
  if (remote) return remote;
  return db ? await db.forms.toArray() : [];
};

export const getForm = async id => {
  const remote = await runRemote(async () => {
    const res = await fetch(`${SERVER_URL}/backend/index.php/api/getForm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await safeJson(res);
    const form = JSON.parse(data?.formData?.form || '{}').formJSON;
    return { ...form, id: data?.formData?.id || '_' };
  }, 'Server Connection Error');
  if (remote) return remote;
  return db ? await db.forms.get(id) : null;
};

export const getFormsByApplication = async appId => {
  try {
    if (!appId) return [];
    const allForms = await getAllForms();
    return allForms.filter(f => f?.appId === appId).map(f => ({ ...(f || {}), id: f?.id || '_' }));
  } catch (e) {
    console.log(e);
    Notification.error({ title: 'Server Connection Error' });
    return [];
  }
};

export const saveForm = async (formId, utilData = {}) => {
  const ts = nowTs();
  const ok = await runRemote(async () => {
    const data = await getForm(formId);
    const formJSON = { ...data, updatedAt: ts, createdAt: data?.createdAt, ...utilData };
    await fetch(`${SERVER_URL}/backend/index.php/api/saveForm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: formId, formJSON }),
    });
    Notification.success({ title: 'Save success' });
    return true;
  }, 'Save failed');
  if (ok) return;
  if (!db) return;
  const existing = await db.forms.get(formId);
  await db.forms.put({ ...(existing || {}), ...(utilData || {}), id: formId, updatedAt: ts, createdAt: existing?.createdAt ?? ts });
  Notification.success({ title: 'Save success (local)' });
};

export const delForm = async id => {
  const ok = await runRemote(async () => {
    await fetch(`${SERVER_URL}/backend/index.php/api/deleteForm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    Notification.success({ title: 'Delete success' });
    return true;
  }, 'Delete failed');
  if (ok) return;
  if (!db) return;
  await db.forms.delete(id);
  Notification.success({ title: 'Delete success (local)' });
};

export const deleteAllForms = async () => {
  const ok = await runRemote(async () => {
    await fetch(`${SERVER_URL}/backend/index.php/api/deleteAllForms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    Notification.success({ title: 'Delete success' });
    return true;
  }, 'Delete failed');
  if (ok) return;
  if (!db) return;
  await db.forms.clear();
  Notification.success({ title: 'Delete success (local)' });
};

export const addForm = async (utilData = {}, appId = null) => {
  const ts = nowTs();
  const formJSON = { appId, table: null, task_data: [], createdAt: ts, updatedAt: ts, ...utilData };
  const remoteId = await runRemote(async () => {
    const res = await fetch(`${SERVER_URL}/backend/index.php/api/addForm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formJSON }),
    });
    const data = await safeJson(res);
    Notification.success({ title: 'Add Success' });
    return data?.formId || null;
  }, 'Add Failed');
  if (remoteId) return remoteId;
  if (!db) return null;
  const formId = nanoid();
  await db.forms.add({ id: formId, ...formJSON });
  Notification.success({ title: 'Add Success (local)' });
  return formId;
};

/* Queries */
export const getAllQueries = async () => {
  const remote = await runRemote(async () => {
    const res = await fetch(`${SERVER_URL}/backend/index.php/api/getAllQueries`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await safeJson(res);
    return (data?.allQueries || []).map(_q => ({ ...(JSON.parse(_q.query || '{}').queryJSON || {}), id: _q?.id || '_' }));
  }, 'Server Connection Error');
  if (remote) return remote;
  return db ? await db.queries.toArray() : [];
};

export const getQuery = async id => {
  const remote = await runRemote(async () => {
    const res = await fetch(`${SERVER_URL}/backend/index.php/api/getQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await safeJson(res);
    const q = JSON.parse(data?.queryData?.query || '{}').queryJSON;
    return { ...q, id: data?.queryData?.id || '_' };
  }, 'Server Connection Error');
  if (remote) return remote;
  return db ? await db.queries.get(id) : null;
};

export const getAllQueriesByApplication = async appId => {
  try {
    if (!appId) return [];
    const allQueries = await getAllQueries();
    return allQueries.filter(q => q?.appId === appId).map(q => ({ ...(q || {}), id: q?.id || '_' }));
  } catch (e) {
    console.log(e);
    Notification.error({ title: 'Server Connection Error' });
    return [];
  }
};

export const saveQuery = async (queryId, utilData = {}) => {
  const ts = nowTs();
  const ok = await runRemote(async () => {
    const data = await getQuery(queryId);
    const queryJSON = { ...data, updatedAt: ts, createdAt: data?.createdAt, ...utilData };
    await fetch(`${SERVER_URL}/backend/index.php/api/saveQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: queryId, queryJSON }),
    });
    Notification.success({ title: 'Save success' });
    return true;
  }, 'Save failed');
  if (ok) return;
  if (!db) return;
  const existing = await db.queries.get(queryId);
  await db.queries.put({ ...(existing || {}), ...(utilData || {}), id: queryId, updatedAt: ts, createdAt: existing?.createdAt ?? ts });
  Notification.success({ title: 'Save success (local)' });
};

export const delQuery = async id => {
  const ok = await runRemote(async () => {
    await fetch(`${SERVER_URL}/backend/index.php/api/deleteQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    Notification.success({ title: 'Delete success' });
    return true;
  }, 'Delete failed');
  if (ok) return;
  if (!db) return;
  await db.queries.delete(id);
  Notification.success({ title: 'Delete success (local)' });
};

export const deleteAllQueries = async () => {
  const ok = await runRemote(async () => {
    await fetch(`${SERVER_URL}/backend/index.php/api/deleteAllQueries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    Notification.success({ title: 'Delete success' });
    return true;
  }, 'Delete failed');
  if (ok) return;
  if (!db) return;
  await db.queries.clear();
  Notification.success({ title: 'Delete success (local)' });
};

export const addQuery = async (utilData = {}, appId = null) => {
  const ts = nowTs();
  const queryJSON = { appId, table: '', fields: [], createdAt: ts, updatedAt: ts, ...utilData };
  const remoteId = await runRemote(async () => {
    const res = await fetch(`${SERVER_URL}/backend/index.php/api/addQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryJSON }),
    });
    const data = await safeJson(res);
    Notification.success({ title: 'Add Success' });
    return data?.queryId || null;
  }, 'Add Failed');
  if (remoteId) return remoteId;
  if (!db) return null;
  const queryId = nanoid();
  await db.queries.add({ id: queryId, ...queryJSON });
  Notification.success({ title: 'Add Success (local)' });
  return queryId;
};

export const runQuery = async (queryString = '', connectConfig = { hostname: null, username: null, password: null, database: null }) => {
  const remote = await runRemote(async () => {
    if (queryString?.length > 0) {
      const res = await fetch(`${SERVER_URL}/backend/index.php/api/runQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sqlValue: queryString, connectConfig }),
      });
      const data = await safeJson(res);
      return data?.executionResults ?? null;
    }
    return null;
  });
  // No local SQL engine available; return null gracefully
  return remote ?? null;
};
