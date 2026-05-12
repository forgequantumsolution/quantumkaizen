const mergeFieldsWithValues = (fields, submission) => {
  if (!submission || !submission.field_values) {
    return fields;
  }

  const valueMap = {};
  submission.field_values.forEach((fieldValue) => {
    valueMap[fieldValue.field_id] = fieldValue.value;
  });

  return fields.map((field) => ({
    ...field,
    value: valueMap[field.field_id] || field.value,
  }));
};

export default mergeFieldsWithValues;
