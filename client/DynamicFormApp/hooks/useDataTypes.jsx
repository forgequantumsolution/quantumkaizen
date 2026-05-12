import { useEffect, useState } from "react";
import { data_types } from "../api/dynamic-form-api";

export const useDataTypes = () => {
  const [dataTypes, setDataTypes] = useState([]);

  const success_data_types = (res) => {
    if (res.status === 200) {
      // API response structure: res.data = { status, message, data: { data_types: [...] } }
      setDataTypes(res.data?.data?.data_types || res.data?.data_types || []);
    }
  };
  useEffect(() => {
    data_types(success_data_types);
  }, []);

  return dataTypes;
};
