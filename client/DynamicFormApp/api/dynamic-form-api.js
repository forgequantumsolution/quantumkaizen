import API_CONFIG from "@/utils/apiConfig";
import { get, post, put, del, upload, download } from "@/utils/httpClient";
import { invalidateCache, getCacheBuster } from "@/utils/cacheUtils";

const { API: api, FORMS: forms } = API_CONFIG;

// ===============================================GET===============================================


export const get_form_with_sections = (success, params = {}, signal = null) =>
  get(`${forms}/form/with_sections/`, success, params);
// ===============================================POST===============================================

export const save_ticket_form = (success, data) =>
  post(`${api}/save_ticket_form`, success, data, true);



// =============================================== NEW GET ===============================================

export const get_dynamic_form = (success, params = {}, signal = null) => {
  const cacheBuster = getCacheBuster("form");
  return get(`${forms}/form/get/`, success, { ...params, _t: cacheBuster }, signal);
};

export const get_form_fields = (success, params = {}, signal = null) => {
  const cacheBuster = getCacheBuster("form");
  return get(`${forms}/form/fields/get/${params.id}/`, success, { _t: cacheBuster });
};

export const get_field_types = (success, params = {}, signal = null) => {
  const cacheBuster = getCacheBuster("field_type");
  return get(`${forms}/field_types/`, success, { ...params, _t: cacheBuster }, signal);
};

export const data_types = (success, params = {}, signal = null) =>
  get(`${forms}/data_types/`, success, params, signal);

export const get_form_draft = (success, params = {}, signal = null, onError = null, options = {}) => {
  const cacheBuster = getCacheBuster("form");
  return get(`${forms}/form_draft/get/${params.id}/`, success, { _t: cacheBuster }, signal, onError, options);
};

export const get_checklist_type = (success, params = {}, signal = null) => {
  const cacheBuster = getCacheBuster("form_type");
  return get(`${forms}/form_types/`, success, { ...params, _t: cacheBuster }, signal);
};



// =============================================== NEW POST ===============================================


export const add_field_type = (success, data) => {
  const result = post(`${forms}/field_types/create/`, success, data, true);
  invalidateCache("field_type");
  return result;
};

export const update_field_type = (success, data, id) => {
  const result = put(`${forms}/field_types/update/${id}/`, success, data, true);
  invalidateCache("field_type");
  return result;
};

export const post_form_draft = (success, data, id) => {
  const result = post(`${forms}/form_draft/save/${id}/`, success, data, true);
  invalidateCache("form");
  return result;
};

export const create_dynamic_form = (success, data) => {
  const result = post(`${forms}/form/create/`, success, data, true);
  invalidateCache("form");
  return result;
};

export const create_form_fields = (success, data, id, onError = null) => {
  const result = post(`${forms}/form/fields/create/${id}/`, success, data, true, onError, { suppressToast: !!onError });
  invalidateCache("form");
  return result;
};


// ========================================= Delete checklist by ID ========================================

export const delete_checklist_by_id = async (checklist_id) => {
  const result = await del(`${forms}/form/delete/${checklist_id}/`);
  invalidateCache("form");
  return result;
};

// ========================================= Audit Checklists API ========================================

export const get_complete_iso_standards = (success, params = {}, signal = null) => {
  const cacheBuster = getCacheBuster("audit_checklist");
  return get(`${api}/get_complete_iso_standards`, success, { ...params, _t: cacheBuster }, signal);
};

export const add_iso_standard = (success, data) => {
  const result = post(`${api}/add_iso_standard`, success, data, true);
  invalidateCache("audit_checklist");
  return result;
};

export const update_iso_standard = (success, data, id) => {
  const result = put(`${api}/update_iso_standard/${id}/`, success, data, true);
  invalidateCache("audit_checklist");
  return result;
};

export const delete_iso_standard = async (checklist_id) => {
  const result = await del(`${api}/delete_iso_standard/${checklist_id}/`);
  invalidateCache("audit_checklist");
  return result;
};

export const export_iso_standards = async (filename = "iso_standards.xlsx") => {
  return download(`${api}/export_iso_standards`, filename);
};

export const bulk_upload_iso_standards = (success, file, onError = null) => {
  const formData = new FormData();
  formData.append("file", file);
  const result = upload(`${api}/bulk_upload_iso_standards`, success, formData, "file", onError);
  invalidateCache("audit_checklist");
  return result;
};
