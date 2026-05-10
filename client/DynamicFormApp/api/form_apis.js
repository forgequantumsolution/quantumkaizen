import API_CONFIG, { baseUrl } from "@/utils/apiConfig";
import { get, post, put, del, upload, patch } from "@/utils/httpClient";
import { invalidateCache } from "@/utils/cacheUtils";

const { API: api, FORMS: forms } = API_CONFIG;

export const deleteCustomFieldType = (id, success) => {
  const result = del(`${forms}/field_types/delete/${id}/`, success);
  invalidateCache("field_type");
  return result;
};

export const getSupplierFormData = (success, params, signal, onError, options) =>
  get(`${api}/get_supplier_form_data`, success, params, signal, onError, { suppressToast: true, ...options });

export const downloadSupplierPdf = async () => {
  // Placeholder - not implemented
};

export const get_nc_suggestions = (success, params, signal) =>
  get(`${api}/get_nc_suggestions`, success, params, signal);

export const create_subtickets = (data, success) =>
  post(`${api}/create_subtickets`, (res) => success(res, null), data, true, (err) => success(null, err?.response?.data));

export const request_sla_extension = (data, success) =>
  post(`${api}/request_sla_extension`, (res) => success(res, null), data, true, (err) => success(null, err?.response?.data));

export const read_all_sla_notifications = (success) =>
  get(`${api}/manage_sla_requests_seen`, (res) => success(res.data, null), { mark_seen: true }, null, (err) => success(null, err?.response?.data));

export const get_sla_notifications = (callback) =>
  get(`${api}/manage_sla_requests_seen`, (res) => callback(res.data, null), {}, null, (err) => callback(null, err));

export const get_unread_notifications = (callback) =>
  get(`${api}/manage_sla_requests_seen`, (res) => callback(res.data, null), { is_seen: false }, null, (err) => callback(null, err));

export const get_seen_notifications = (callback) =>
  get(`${api}/manage_sla_requests_seen`, (res) => callback(res.data, null), { is_seen: true }, null, (err) => callback(null, err));

export const mark_notifications_seen = (seenIds, notification_category, callback) =>
  post(`${api}/manage_sla_requests_seen`, (res) => callback(res, null), { seen_ids: seenIds, notification_category }, true, (err) => callback(null, err));

export const get_sla_extension_requests = (success) =>
  get(`${api}/get_sla_extension_requests`, (res) => success(res.data, null), {}, null, (err) => success(null, err?.response?.data));

export const approve_sla_extension = (id, data, success) =>
  post(`${api}/approve_sla_extension/${id}/`, (res) => success(res, null), data, true, (err) => success(null, err?.response?.data));

export const get_stage_sla_extension = (params, success) =>
  get(`${api}/get_stage_sla_extension`, (res) => success(res.data, null), params, null, (err) => success(null, err?.response?.data));

// Pause/Resume SLA APIs
export const request_sla_pause_resume = (data, success) =>
  post(`${api}/sla/pause-resume/request/`, (res) => success(res, null), data, true, (err) => success(null, err?.response?.data));

export const get_sla_pause_resume_requests = (params, success) =>
  get(`${api}/sla/pause-resume/requests/`, (res) => success(res.data, null), params, null, (err) => success(null, err?.response?.data));

export const approve_sla_pause_resume = (id, data, success) =>
  post(`${api}/sla/pause-resume/${id}/approve/`, (res) => success(res, null), data, true, (err) => success(null, err?.response?.data));

export const get_notification_count = (success) =>
  get(`${api}/manage_sla_requests_seen`, (res) => success(res.data, null), {}, null, (err) => success(null, err?.response?.data));


// ====================================== NEW EDITED API FILES ======================================

export const addFormType = (callback, values) => {
  const result = post(`${forms}/form_types/create/`, callback, values, true, callback);
  invalidateCache("form_type");
  return result;
};

export const updateFormType = (callback, id, values) => {
  const result = put(`${forms}/form_types/${id}/update/`, callback, values, true, callback);
  invalidateCache("form_type");
  return result;
};

export const deleteFormType = (callback, id) => {
  const result = del(`${forms}/form_types/${id}/delete/`, callback);
  invalidateCache("form_type");
  return result;
};

// ====================================== BULK UPLOAD FORMS API ======================================

/**
 * Download the bulk upload template for forms
 */
export const download_forms_template = async (success, error) => {
  try {
    const res = await get(`${forms}/form/bulk/template/download/`, null, {}, null, null, { responseType: "blob" });

    // Create download using anchor element
    const blob = new Blob([res], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'forms_upload_template.xlsx');
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (success) success(res);
    return res;
  } catch (err) {
    if (error) error(err);
    throw err;
  }
};

/**
 * Upload bulk forms data
 * @param {File} file - The Excel file to upload
 * @param {Function} success - Success callback
 * @param {Function} error - Error callback
 * @param {Object} queryParams - Optional query parameters (e.g., auto_create_missing)
 */
export const upload_forms_data = async (file, success, error, queryParams = {}) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await upload(`${forms}/form/bulk/upload/`, null, formData, "file", null, { params: queryParams });

    if (success) success(res);
    return res;
  } catch (err) {
    if (error) error(err);
    throw err;
  }
};

/**
 * Export all forms as Excel file
 */
export const export_forms_bulk = async (success, error) => {
  try {
    const res = await get(`${forms}/form/bulk/export/`, null, {}, null, null, { responseType: "blob" });

    // Create download using anchor element
    const blob = new Blob([res], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'forms_export.xlsx');
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (success) success(res);
    return res;
  } catch (err) {
    if (error) error(err);
    throw err;
  }
};

// ====================================== PDCA RELATED APIs ======================================

/**
 * Get all main processes
 * @param {Function} callback - Callback function
 */
export const get_main_processes = (callback) =>
  get(`${forms}/main_processes/`, callback, {}, null, callback);

/**
 * Get all criteria
 * @param {Function} callback - Callback function
 */
export const get_criteria = (callback) =>
  get(`${forms}/criteria/`, callback, {}, null, callback);

/**
 * Get all audit schedules with info
 * @param {Function} callback - Callback function
 * @param {Object} params - Optional query parameters
 */
export const get_audit_schedules_with_info = (callback, params = {}) =>
  get(`${api}/get_audit_schedules_with_info`, callback, params, null, callback);

/**
 * Update audit date for a schedule
 * @param {string} scheduleId - The schedule ID to update
 * @param {Object} data - The data to update (audit_date)
 * @param {Function} callback - Callback function
 */
export const update_audit_date = (scheduleId, data, callback) =>
  patch(`${api}/update_audit_date/${scheduleId}/`, callback, data, true, callback);

/**
 * Get audit schedule filter options (titles, locations, financial_years)
 * @param {Function} callback - Callback function
 */
export const get_audit_schedule_filters = (callback) =>
  get(`${api}/get_audit_schedule_filters`, callback, {}, null, callback);
