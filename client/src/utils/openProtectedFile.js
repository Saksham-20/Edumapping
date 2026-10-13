// client/src/utils/openProtectedFile.js
import toast from 'react-hot-toast';
import api from '../services/api';

/**
 * Open (or download) a private file — a resume, a marksheet, an offer letter —
 * that the server only hands out to a signed-in user who is allowed to see it.
 *
 * These files used to be plain links into the public `/uploads` folder, so a
 * student's resume or marksheet was downloadable by anyone holding (or
 * guessing) the URL, no sign-in needed. The server now serves `/uploads`
 * publicly for images only, and everything else goes through
 * `GET /api/files/serve?path=…`, which checks the same visibility rule as the
 * profile endpoint. An `<a href>` cannot carry the Bearer token, so the file is
 * fetched through the axios instance as a Blob and opened from an object URL.
 *
 * @param {string} pathOrUrl  Whatever the API stored for the file:
 *   - a stored path such as `/uploads/123-abc-resume_5_1.pdf`,
 *   - a full URL containing `/uploads/` (older rows, or REACT_APP_API_URL builds),
 *   - an `/api/files/:id/download` path (or `/files/:id/download`).
 * @param {object}  [options]
 * @param {boolean} [options.download=false] Save the file instead of opening a tab.
 * @param {string}  [options.filename]       Name for the saved file.
 * @returns {Promise<boolean>} true when the file was opened or saved.
 */
export default async function openProtectedFile(pathOrUrl, { download = false, filename } = {}) {
  const request = toApiRequest(pathOrUrl);
  if (!request) {
    toast.error('This file is not available.');
    return false;
  }

  // A tab opened after an `await` is no longer tied to the click, and popup
  // blockers swallow it. Open a blank one now and point it at the file once
  // the bytes have arrived.
  const tab = download ? null : window.open('', '_blank');
  if (tab) {
    try {
      tab.document.title = 'Opening file…';
    } catch (e) {
      // Cross-origin or blocked — harmless, the location is set below.
    }
  }

  try {
    const blob = await api.get(request.url, {
      params: request.params,
      responseType: 'blob',
      // The interceptor's own toast would read "Request failed with status
      // code 404" here, because a blob error body is not parsed as JSON.
      // Failures are explained below instead.
      silent: true,
      // Resumes can be a few MB; the default 10s is tight on a slow link.
      timeout: 60000
    });

    const objectUrl = URL.createObjectURL(blob);
    if (tab && !download) {
      tab.location.href = objectUrl;
    } else {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename || request.suggestedName || 'document';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    // Long enough for the tab to load the document before the URL dies.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
    return true;
  } catch (error) {
    if (tab) tab.close();
    const status = error?.status || error?.response?.status;
    if (status === 404) {
      toast.error('This file could not be found, or you do not have access to it.');
    } else if (status === 403) {
      toast.error('You do not have access to this file.');
    } else if (status === 401) {
      toast.error('Please sign in again to open this file.');
    } else {
      toast.error('Could not open the file. Please try again.');
    }
    return false;
  }
}

/** Turn whatever was stored into a request against the API instance. */
function toApiRequest(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;
  let value = pathOrUrl.trim();

  // A full URL: keep only the path, the API origin comes from axios.
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch (e) {
      return null;
    }
  }

  const uploadsAt = value.indexOf('/uploads/');
  if (uploadsAt !== -1) {
    const stored = value.slice(uploadsAt);
    return {
      url: '/files/serve',
      params: { path: stored },
      suggestedName: decodeURIComponent(stored.split('/').pop() || '')
    };
  }

  // `/api/files/12/download` or `/files/12/download`. The axios baseURL
  // already ends in `/api`, so strip it to avoid `/api/api/...`.
  const filesMatch = value.match(/(?:^|\/)files\/.+$/);
  if (filesMatch) {
    return { url: `/${filesMatch[0].replace(/^\//, '')}` };
  }

  return null;
}
