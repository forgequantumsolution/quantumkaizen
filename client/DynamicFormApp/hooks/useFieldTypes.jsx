// useFieldTypes.js
import { useEffect, useState, useCallback } from "react";
import { get_field_types } from "../api/dynamic-form-api";

export const useFieldTypes = () => {
  const [FIELD_TYPES, SET_FIELD_TYPES] = useState([]);

  const success_get_field_types = (res) => {
    if (res.status === 200) {
      // API response structure: res.data = { status, message, data: { field_types: [...] } }
      SET_FIELD_TYPES(res.data?.data?.field_types || res.data?.field_types || []);
    }
  };

  const refetch = useCallback(() => {
    get_field_types(success_get_field_types);
  }, []);

  useEffect(() => {
    refetch(); // Fetch on initial render
  }, [refetch]);

  return { FIELD_TYPES, refetch };
};
