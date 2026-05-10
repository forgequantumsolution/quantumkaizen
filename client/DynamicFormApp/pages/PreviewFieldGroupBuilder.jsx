import { useEffect, useState, useRef, useMemo } from "react";
import {
  Form,
  Input,
  Select,
  DatePicker,
  Upload,
  Button,
  Row,
  Col,
  Space,
  InputNumber,
  Card,
  Checkbox,
  Radio,
  TimePicker,
  Slider,
  Switch,
  ColorPicker,
  Toast,
  NxUpload,
  NxTrash,
  NxPlus,
  NxEyeOff,
  NxEye,
  NxCheckCircle,
  NxAlertCircle,
} from "@nexgensis/core";
import { Formik, Form as FormikForm, FieldArray } from "formik";
import * as Yup from "yup";
import dayjs from "dayjs";
import SignatureCanvas from "react-signature-canvas";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import Axios from "axios";
import { API_CONFIG, baseUrl } from "@/utils/apiConfig";
import TableViewer from "./TableViewer";

// Helper function to check if a field should be visible based on its dependency
const isFieldVisible = (field, allSections, formValues) => {
  // If no dependency is configured, field is always visible
  if (!field.dependency) {
    return true;
  }

  // Support both cascader format and individual fields format
  const { field_section, field_name, option_selected, options_selected, cascader_selection } = field.dependency;

  // Extract dependency info from cascader_selection if available
  let targetSection, targetField, targetOptions;
  
  // Support multiple field dependencies, cascader format, and individual fields format
  const { multiple_field_dependencies } = field.dependency;

  // Extract multiple field dependencies
  let fieldDependencies = [];
  
  if (multiple_field_dependencies && multiple_field_dependencies.length > 0) {
    // Use multiple field dependencies directly
    fieldDependencies = multiple_field_dependencies;
  } else if (cascader_selection && cascader_selection.length > 0) {
    // Extract from cascader_selection format: [[section, field, option1], [section, field, option2], ...]
    const pathsByField = {};
    cascader_selection.forEach(path => {
      if (path.length >= 3) {
        const [section, field, option] = path;
        const key = `${section}|${field}`;
        if (!pathsByField[key]) {
          pathsByField[key] = {
            field_section: section,
            field_name: field,
            options_selected: []
          };
        }
        pathsByField[key].options_selected.push(option);
      }
    });
    
    fieldDependencies = Object.values(pathsByField);
  } else if (field_section && field_name) {
    // Use individual fields (single dependency)
    const targetOptions = options_selected && options_selected.length > 0 
      ? options_selected 
      : option_selected ? [option_selected] : [];
    
    if (targetOptions.length > 0) {
      fieldDependencies = [{
        field_section,
        field_name,
        options_selected: targetOptions
      }];
    }
  }

  // If no valid dependency configuration, show field
  if (fieldDependencies.length === 0) {
    return true;
  }

  // Check if ANY of the target options match the current value for a single field
  const checkFieldDependency = (dependency) => {
    const { field_section: targetSection, field_name: targetField, options_selected: targetOptions } = dependency;

    // Find the section that contains the dependency field
    let dependencySection = allSections.find(
      section => section.section_name === targetSection
    );

    // If section not found by name, try to match by index (e.g., "Section 1" -> index 0)
    if (!dependencySection) {
      const sectionIndexMatch = targetSection.match(/Section (\d+)/i);
      if (sectionIndexMatch) {
        const sectionIndex = parseInt(sectionIndexMatch[1]) - 1;
        dependencySection = allSections[sectionIndex];
      }
    }

    if (!dependencySection) {
      return false; // If dependency section not found, hide the field
    }

    // Find the dependency field
    const dependencyField = dependencySection.fields.find(
      f => f.name === targetField
    );

    if (!dependencyField) {
      return false; // If dependency field not found, hide the field
    }

    // Get the current value of the dependency field from form values
    const dependencyValue = formValues[targetField];

    if (!dependencyValue) {
      return false; // If dependency field has no value, condition not met
    }

    // Check if any of the target options match the current value
    const checkValueMatch = (value) => {
      if (value === null || value === undefined) return false;

      // Handle object with value/label property
      const valueToCheck = typeof value === "object"
        ? (value.value || value.label || value)
        : value;

      return targetOptions.some((opt) => {
        const optValue = typeof opt === "object" ? (opt.value || opt.label || opt) : opt;
        return String(valueToCheck) === String(optValue);
      });
    };

    // Handle different value formats (string, object with value property, array)
    if (Array.isArray(dependencyValue)) {
      return dependencyValue.some(checkValueMatch);
    } else {
      return checkValueMatch(dependencyValue);
    }
  };

  // ALL field dependencies must be satisfied (AND logic)
  return fieldDependencies.every(checkFieldDependency);
};

// Helper function to check if a section should be visible based on its dependency
const isSectionVisible = (section, allSections, formValues) => {
  // If no dependency is configured, section is always visible
  if (!section.dependency) {
    return true;
  }

  const { field_section, field_name, options_selected, cascader_selection, multiple_field_dependencies } = section.dependency;

  // Extract dependency info
  let sectionDependencies = [];

  if (multiple_field_dependencies && multiple_field_dependencies.length > 0) {
    sectionDependencies = multiple_field_dependencies;
  } else if (cascader_selection && cascader_selection.length > 0) {
    // Extract from cascader_selection format
    const pathsByField = {};
    cascader_selection.forEach(path => {
      if (path.length >= 3) {
        const [sec, field, option] = path;
        const key = `${sec}|${field}`;
        if (!pathsByField[key]) {
          pathsByField[key] = {
            field_section: sec,
            field_name: field,
            options_selected: []
          };
        }
        pathsByField[key].options_selected.push(option);
      }
    });
    sectionDependencies = Object.values(pathsByField);
  } else if (field_section && field_name && options_selected && options_selected.length > 0) {
    sectionDependencies = [{
      field_section,
      field_name,
      options_selected
    }];
  }

  // If no valid dependency configuration, show section
  if (sectionDependencies.length === 0) {
    return true;
  }

  // Check if dependency condition is met for a single field
  const checkDependency = (dependency) => {
    const { field_section: targetSection, field_name: targetField, options_selected: targetOptions } = dependency;

    // Find the section that contains the dependency field
    let dependencySection = allSections.find(
      sec => sec.section_name === targetSection
    );

    // If section not found by name, try to match by index (e.g., "Section 1" -> index 0)
    if (!dependencySection) {
      const sectionIndexMatch = targetSection.match(/Section (\d+)/i);
      if (sectionIndexMatch) {
        const sectionIndex = parseInt(sectionIndexMatch[1]) - 1;
        dependencySection = allSections[sectionIndex];
      }
    }

    if (!dependencySection) {
      return false; // If dependency section not found, hide the section
    }

    // Find the dependency field
    const dependencyField = dependencySection.fields.find(
      f => f.name === targetField
    );

    if (!dependencyField) {
      return false; // If dependency field not found, hide the section
    }

    // Get the current value of the dependency field from form values
    const dependencyValue = formValues[targetField];

    if (!dependencyValue) {
      return false; // If dependency field has no value, condition not met
    }

    // Check if any of the target options match the current value
    const checkValueMatch = (value) => {
      if (value === null || value === undefined) return false;

      // Handle object with value/label property
      const valueToCheck = typeof value === "object"
        ? (value.value || value.label || value)
        : value;

      return targetOptions.some((opt) => {
        const optValue = typeof opt === "object" ? (opt.value || opt.label || opt) : opt;
        return String(valueToCheck) === String(optValue);
      });
    };

    // Handle different value formats (string, object with value property, array)
    if (Array.isArray(dependencyValue)) {
      return dependencyValue.some(checkValueMatch);
    } else {
      return checkValueMatch(dependencyValue);
    }
  };

  // ALL dependencies must be satisfied (AND logic)
  return sectionDependencies.every(checkDependency);
};

const { API: api, } = API_CONFIG;

const { TextArea, Password } = Input;
const { Group: RadioGroup } = Radio;
const { Group: CheckboxGroup } = Checkbox;

const { RangePicker } = DatePicker;

const createFormikSchema = (formData) => {
  const initialValues = {};
  const validationShape = {};

  if (formData?.sections && Array.isArray(formData?.sections)) {
    formData.sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.type === "table") {
          initialValues[field.name] = field.value || [];
          let arrayValidator = Yup.array();
          if (field.required) {
            arrayValidator = arrayValidator.min(
              1,
              `At least one ${field.label} is required`,
            );
          }
          if (field.validation) {
            if (
              field.validation.minCount !== undefined &&
              field.validation.minCount !== null
            ) {
              arrayValidator = arrayValidator.min(
                field.validation.minCount,
                `${field.label} must have at least ${field.validation.minCount} entries`,
              );
            }
            if (
              field.validation.maxCount !== undefined &&
              field.validation.maxCount !== null
            ) {
              arrayValidator = arrayValidator.max(
                field.validation.maxCount,
                `${field.label} must have at most ${field.validation.maxCount} entries`,
              );
            }
          }

          if (field.fields && field.fields.length > 0) {
            arrayValidator = arrayValidator.of(
              Yup.object().shape(
                field.fields.reduce((acc, subfield) => {
                  let validator = getValidatorByType(subfield);

                  if (subfield.required) {
                    validator = validator.required(
                      `${subfield.label} is required`,
                    );
                  }

                  if (subfield.validation) {
                    validator = applyValidationRules(validator, subfield);
                  }

                  acc[subfield.name] = validator;
                  return acc;
                }, {}),
              ),
            );
          }

          validationShape[field.name] = arrayValidator;
        } else {
          initialValues[field.name] = getInitialValue(field);
          let validator = getValidatorByType(field);

          if (field.required) {
            validator = validator
              .required(`${field.label} is required`)
              .nullable();
          }

          if (field.validation) {
            validator = applyValidationRules(validator, field);
          }

          validationShape[field.name] = validator;
        }
      });
    });
  }
  return { initialValues, validationSchema: Yup.object(validationShape) };
};

const createSectionValidationSchema = (section) => {
  const validationShape = {};

  // Check if section has fields array
  if (section.fields && Array.isArray(section.fields)) {
    section.fields.forEach((field) => {
      if (field.type === "table") {
        let arrayValidator = Yup.array();

        if (field.required) {
          arrayValidator = arrayValidator.min(
            1,
            `At least one ${field.label} is required`,
          );
        }

        if (field.validation) {
          if (
            field.validation.minCount !== undefined &&
            field.validation.minCount !== null
          ) {
            arrayValidator = arrayValidator.min(
              field.validation.minCount,
              `${field.label} must have at least ${field.validation.minCount} entries`,
            );
          }
          if (
            field.validation.maxCount !== undefined &&
            field.validation.maxCount !== null
          ) {
            arrayValidator = arrayValidator.max(
              field.validation.maxCount,
              `${field.label} must have at most ${field.validation.maxCount} entries`,
            );
          }
        }

        if (field.fields && field.fields.length > 0) {
          arrayValidator = arrayValidator.of(
            Yup.object().shape(
              field.fields.reduce((acc, subfield) => {
                let validator = getValidatorByType(subfield);

                if (subfield.required) {
                  validator = validator.required(
                    `${subfield.label} is required`,
                  );
                }

                if (subfield.validation) {
                  validator = applyValidationRules(validator, subfield);
                }

                acc[subfield.name] = validator;
                return acc;
              }, {}),
            ),
          );
        }

        validationShape[field.name] = arrayValidator;
      } else {
        let validator = getValidatorByType(field);

        if (field.required) {
          validator = validator.required(`${field.label} is required`);
        }

        if (field.validation) {
          validator = applyValidationRules(validator, field);
        }

        validationShape[field.name] = validator;
      }
    });
  }

  return Yup.object(validationShape);
};

const getInitialValue = (field) => {
  switch (field.type) {
    case "checkbox":
      return field.value || [];
    case "switch":
      return field.value || false;
    case "number":
    case "range":
      return field.value !== undefined && field.value !== null
        ? Number(field.value)
        : null;
    case "select":
      return field.validation?.isMultiple
        ? field?.value || []
        : field?.value || null;
    case "file":
    case "image":
      return field.validation?.isMultiple
        ? field.value || []
        : field.value || null;
    case "date_range":
    case "time_range":
      return field.value || [];
    case "color":
      return field.value || "#1677ff";
    case "signature":
      return field.value || null;
    case "richtext":
      return field.value || null;
    default:
      return field.value || null;
  }
};

const getValidatorByType = (field) => {
  const isRequired = field.required === true;

  switch (field.type) {
    case "number": {
      let validator = Yup.number().transform((value, originalValue) =>
        originalValue === "" || originalValue === null ? undefined : value,
      );

      if (isRequired) {
        validator = validator
          .typeError(`${field.label} must be a number`)
          .required(`${field.label} is required`);

        if (field.validation?.isInteger) {
          validator = validator.integer(`${field.label} must be an integer`);
        }
        if (field.validation?.isPositive) {
          validator = validator.positive(`${field.label} must be positive`);
        }
      } else {
        validator = validator.nullable();
      }

      return validator;
    }

    case "switch":
      return isRequired
        ? Yup.boolean().required(`${field.label} is required`)
        : Yup.boolean().nullable();

    case "checkbox": {
      let validator = Yup.array();

      if (isRequired) {
        validator = validator.min(1, `${field.label} is required`);
        if (field.validation?.minCount != null) {
          validator = validator.min(
            field.validation.minCount,
            `${field.label} must have at least ${field.validation.minCount} selections`,
          );
        }
        if (field.validation?.maxCount != null) {
          validator = validator.max(
            field.validation.maxCount,
            `${field.label} must have at most ${field.validation.maxCount} selections`,
          );
        }
      } else {
        validator = validator.nullable();
      }

      return validator;
    }

    case "select": {
      const isMultiple = field.validation?.isMultiple;
      let validator;
      if (isMultiple) {
        validator = Yup.array().of(
          Yup.object({
            label: Yup.string().required(),
            value: Yup.string().required(),
          }),
        );
        if (isRequired) {
          validator = validator.min(1, `${field.label} is required`);
        }
        if (field.validation?.minCount != null) {
          validator = validator.min(
            field.validation.minCount,
            `${field.label} must have at least ${field.validation.minCount} selections`,
          );
        }
        if (field.validation?.maxCount != null) {
          validator = validator.max(
            field.validation.maxCount,
            `${field.label} must have at most ${field.validation.maxCount} selections`,
          );
        }
      } else {
        validator = Yup.object({
          label: Yup.string().nullable().required(),
          value: Yup.string().nullable().required(`${field.label} is required`),
        });

        if (!isRequired) {
          validator = validator.nullable();
        }
      }
      return validator;
    }

    case "file":
    case "image": {
      const isMultiple = field.validation?.isMultiple;

      if (isMultiple) {
        let validator = Yup.array().of(
          Yup.object().shape({
            file_id: Yup.string().required(),
            file_name: Yup.string().required(),
            file_type: Yup.string().required(),
            file_size: Yup.number().required(),
            file_url: Yup.string(),
          }),
        );

        if (isRequired) {
          validator = validator.min(1, `${field.label} is required`);

          if (field.validation.minSelection) {
            validator = validator.min(
              field.validation.minSelection,
              `${field.label} must have at least ${field.validation.minSelection} files`,
            );
          }
          if (field.validation.maxSelection) {
            validator = validator.max(
              field.validation.maxSelection,
              `${field.label} must have at most ${field.validation.maxSelection} files`,
            );
          }
          if (field.validation.fileType) {
            const allowedTypes = field.validation.fileType
              .split(",")
              .map((t) => t.trim());

            validator = validator.test(
              "file-type",
              `Only ${allowedTypes.join(", ")} files are allowed`,
              (value) =>
                !value ||
                value.every((file) =>
                  allowedTypes.includes(
                    file.file_name?.split(".").pop().toLowerCase(),
                  ),
                ),
            );
          }
        } else {
          validator = validator.nullable();
        }

        return validator;
      }

      let validator = Yup.object()
        .shape({
          file_id: Yup.string().required(),
          file_name: Yup.string().required(),
          file_type: Yup.string().required(),
          file_size: Yup.number().required(),
          file_url: Yup.string(),
        })
        .nullable();

      if (isRequired) {
        if (field.validation?.fileType) {
          const allowedTypes = field.validation.fileType
            .split(",")
            .map((t) => t.trim());

          validator = validator.test(
            "file-type",
            `Only ${allowedTypes.join(", ")} files are allowed`,
            (value) => {
              if (!value?.file_name) return false;
              const fileExt = value.file_name.split(".").pop().toLowerCase();
              return allowedTypes.includes(fileExt);
            },
          );
        }
      } else {
        validator = Yup.mixed().nullable();
      }

      return validator;
    }

    case "date": {
      let validator = Yup.string();

      if (isRequired) {
        if (field.validation?.minDate) {
          validator = validator.test(
            "min-date",
            `${field.label} must be after ${field.validation.minDate}`,
            (value) =>
              !value || dayjs(value).isAfter(dayjs(field.validation.minDate)),
          );
        }

        if (field.validation?.maxDate) {
          validator = validator.test(
            "max-date",
            `${field.label} must be before ${field.validation.maxDate}`,
            (value) =>
              !value || dayjs(value).isBefore(dayjs(field.validation.maxDate)),
          );
        }

        validator = validator.required(`${field.label} is required`);
      } else {
        validator = validator.nullable();
      }

      return validator;
    }

    case "date_range": {
      let validator = Yup.array();

      return isRequired
        ? validator
          .length(2, `${field.label} must have start and end dates`)
          .required(`${field.label} is required`)
        : validator.nullable();
    }

    case "time": {
      let validator = Yup.string();

      if (isRequired) {
        if (field.validation?.minTime) {
          validator = validator.test(
            "min-time",
            `${field.label} must be after ${field.validation.minTime}`,
            (value) =>
              !value ||
              dayjs(value, "HH:mm:ss").isAfter(
                dayjs(field.validation.minTime, "HH:mm:ss"),
              ),
          );
        }

        if (field.validation?.maxTime) {
          validator = validator.test(
            "max-time",
            `${field.label} must be before ${field.validation.maxTime}`,
            (value) =>
              !value ||
              dayjs(value, "HH:mm:ss").isBefore(
                dayjs(field.validation.maxTime, "HH:mm:ss"),
              ),
          );
        }

        validator = validator.required(`${field.label} is required`);
      } else {
        validator = validator.nullable();
      }

      return validator;
    }

    case "time_range": {
      let validator = Yup.array();
      return isRequired
        ? validator
          .length(2, `${field.label} must have start and end times`)
          .required(`${field.label} is required`)
        : validator.nullable();
    }

    case "password": {
      let validator = Yup.string();

      if (isRequired) {
        if (field.validation?.containsSpecialChar) {
          validator = validator.matches(
            /[!@#$%^&*(),.?":{}|<>]/,
            `${field.label} must contain at least one special character`,
          );
        }

        if (field.validation?.strengthCheck) {
          validator = validator.test(
            "password-strength",
            `${field.label} must contain uppercase, lowercase, number and special character`,
            (value) => {
              if (!value) return false;
              const hasUpper = /[A-Z]/.test(value);
              const hasLower = /[a-z]/.test(value);
              const hasNumber = /\d/.test(value);
              const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
              return hasUpper && hasLower && hasNumber && hasSpecial;
            },
          );
        }

        validator = validator.required(`${field.label} is required`);
      } else {
        validator = validator.nullable();
      }

      return validator;
    }

    case "richtext": {
      let validator = Yup.string();

      if (isRequired) {
        if (field.validation?.minContentLength) {
          validator = validator.test(
            "min-content-length",
            `${field.label} must have at least ${field.validation.minContentLength} characters`,
            (value) => {
              const text = value?.replace(/<[^>]*>/g, "") || "";
              return text.length >= field.validation.minContentLength;
            },
          );
        }

        if (field.validation?.maxContentLength) {
          validator = validator.test(
            "max-content-length",
            `${field.label} must have at most ${field.validation.maxContentLength} characters`,
            (value) => {
              const text = value?.replace(/<[^>]*>/g, "") || "";
              return text.length <= field.validation.maxContentLength;
            },
          );
        }

        if (field.validation?.disallowedTags) {
          const disallowedTags = field.validation.disallowedTags
            .split(",")
            .map((t) => t.trim());

          validator = validator.test(
            "disallowed-tags",
            `${field.label} contains disallowed tags: ${disallowedTags.join(
              ", ",
            )}`,
            (value) => {
              return !disallowedTags.some(
                (tag) =>
                  value?.includes(`<${tag}`) || value?.includes(`</${tag}>`),
              );
            },
          );
        }

        validator = validator.required(`${field.label} is required`);
      } else {
        validator = validator.nullable();
      }

      return validator;
    }

    case "signature": {
      let validator = Yup.string();

      if (isRequired) {
        if (field.validation?.maxSize) {
          validator = validator.test(
            "signature-size",
            `Signature must be less than ${field.validation.maxSize}KB`,
            (value) => {
              const sizeInKB = value ? (value.length * 3) / 4 / 1024 : 0;
              return sizeInKB <= field.validation.maxSize;
            },
          );
        }

        validator = validator.required(`${field.label} is required`);
      } else {
        validator = validator.nullable();
      }

      return validator;
    }

    case "range": {
      let validator = Yup.number();

      if (isRequired) {
        if (field.validation?.step) {
          validator = validator.test(
            "step-validation",
            `${field.label} must be in steps of ${field.validation.step}`,
            (value) => {
              const min = field.validation?.min || 0;
              return (value - min) % field.validation.step === 0;
            },
          );
        }

        validator = validator.required(`${field.label} is required`);
      } else {
        validator = validator.nullable();
      }

      return validator;
    }

    case "color":
    case "textarea":
      return isRequired
        ? Yup.string().required(`${field.label} is required`)
        : Yup.string().nullable();

    case "email":
      return isRequired
        ? Yup.string()
          .email(`${field.label} must be a valid email`)
          .required(`${field.label} is required`)
        : Yup.string().email(`${field.label} must be a valid email`).nullable();

    default:
      return isRequired
        ? Yup.string().required(`${field.label} is required`)
        : Yup.string().nullable();
  }
};

const applyValidationRules = (validator, field) => {
  if (!field.validation) return validator;
  if (field.validation.pattern) {
    validator = validator.matches(
      new RegExp(field.validation.pattern),
      field.validation.errorMessage || `${field.label} format is invalid`,
    );
  }
  if (["number", "range"].includes(field.type)) {
    if (field.validation.min !== undefined && field.validation.min !== "") {
      validator = validator.min(
        field.validation.min,
        field.validation.errorMessage ||
        `${field.label} must be at least ${field.validation.min}`,
      );
    }
    if (field.validation.max !== undefined && field.validation.max !== "") {
      validator = validator.max(
        field.validation.max,
        field.validation.errorMessage ||
        `${field.label} must be at most ${field.validation.max}`,
      );
    }
  } else if (
    ["text", "email", "password", "textarea", "richtext"].includes(field.type)
  ) {
    if (field.validation.minLength) {
      validator = validator.min(
        field.validation.minLength,
        field.validation.errorMessage ||
        `${field.label} must be at least ${field.validation.minLength} characters`,
      );
    }
    if (field.validation.maxLength) {
      validator = validator.max(
        field.validation.maxLength,
        field.validation.errorMessage ||
        `${field.label} must be at most ${field.validation.maxLength} characters`,
      );
    }
  } else if (
    field.validation?.isMultiple &&
    field.required &&
    (field.type === "select" || field.type === "file" || field.type === "image")
  ) {
    if (field.validation.minSelection && !field.validation.minCount) {
      validator = validator.min(
        field.validation.minSelection,
        field.validation.errorMessage ||
        `${field.label} must have at least ${field.validation.minSelection} selections`,
      );
    }
    if (field.validation.maxSelection && !field.validation.maxCount) {
      validator = validator.max(
        field.validation.maxSelection,
        field.validation.errorMessage ||
        `${field.label} must have at most ${field.validation.maxSelection} selections`,
      );
    }
  }

  return validator;
};

const getDynamicTableErrorMessage = (error) => {
  if (typeof error === "string") {
    return error;
  }
  if (Array.isArray(error)) {
    if (error.every((item) => typeof item === "string")) {
      return error.join(", ");
    }
    if (error.every((item) => typeof item === "object" && item !== null)) {
      return "Please fill these details";
    }
  }
  if (typeof error === "object" && error !== null) {
    return "Please fix the errors in the fields above";
  }

  return "";
};

// Component to monitor API dependencies for non-table fields
const ApiDependencyMonitor = ({ formSchema, formValues, fetchApiDependentOptions, setFieldValue }) => {
  useEffect(() => {
    const allFields = formSchema.sections?.flatMap((section) => section.fields || []) || [];

    // Find fields with API dependencies (excluding table fields)
    const apiDependentFields = allFields.filter((field) =>
      field.validation?.apiDependency?.enabled &&
      field.validation?.apiDependency?.dependsOn &&
      field.dynamic &&
      field.end_point &&
      field.end_point.includes("{id}") &&
      field.type !== "table" // Exclude table fields (handled by TableViewer)
    );

    // For each API-dependent field, check if dependency value exists
    apiDependentFields.forEach((field) => {
      const dependencyFieldName = field.validation.apiDependency.dependsOn;
      const dependencyValue = formValues[dependencyFieldName];

      // Extract value from different field types
      let valueToUse = null;
      if (dependencyValue) {
        if (typeof dependencyValue === 'object' && dependencyValue.value !== undefined) {
          valueToUse = dependencyValue.value;
        } else if (typeof dependencyValue === 'string' || typeof dependencyValue === 'number') {
          valueToUse = dependencyValue;
        }
      }

      if (valueToUse) {
        fetchApiDependentOptions(field, valueToUse);
      } else {
        // Clear dependent field value if dependency is cleared
        if (formValues[field.name]) {
          setFieldValue(field.name, field.validation?.isMultiple ? [] : null);
        }
      }
    });
  }, [formValues, formSchema, fetchApiDependentOptions, setFieldValue]);

  return null; // This component doesn't render anything
};

const PreviewFieldGroupBuilder = ({
  formSchema = {
    form_id: "",
    form_name: "",
    sections: [],
  },
  onSubmit,
}) => {
  const { initialValues, validationSchema } = useMemo(() => {
    return createFormikSchema(formSchema);
  }, [formSchema]);

  const [dynamicOptions, setDynamicOptions] = useState({});
  const [apiDependentOptions, setApiDependentOptions] = useState({});

  // Fetch options for fields with API dependencies
  const fetchApiDependentOptions = async (field, dependencyValue) => {
    if (!field.end_point || !dependencyValue) return;

    // Replace {id} with dependency value
    const processedEndpoint = field.end_point.replace("{id}", dependencyValue);

    // Guard: skip if {id} was not replaced (invalid value)
    if (processedEndpoint.includes("{id}")) return;

    // Create cache key
    const cacheKey = `${field.name}_${dependencyValue}`;

    // Check if already fetched
    if (apiDependentOptions[cacheKey]) return;

    try {
      const response = await Axios.get(`${baseUrl}${processedEndpoint}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("Token")}`,
        },
      });

      const data = response.data.data || response.data;
      const options = data.map((item) => ({
        label: item.name,
        value: item.id,
      }));

      setApiDependentOptions((prev) => ({
        ...prev,
        [cacheKey]: options
      }));
    } catch (error) {
      console.error(`Error fetching dependent options for ${field.name}:`, error);
    }
  };

  const handleWholeFormSubmit = async (values, formikBag) => {
    try {
      const processedValues = { ...values };
      Object.keys(signatureRefs.current).forEach((fieldName) => {
        if (
          signatureRefs.current[fieldName] &&
          !signatureRefs.current[fieldName].isEmpty()
        ) {
          processedValues[fieldName] =
            signatureRefs.current[fieldName].toDataURL();
        }
      });

      const postData = {
        sections: [],
      };

      if (formSchema.sections && Array.isArray(formSchema.sections)) {
        formSchema.sections.forEach((section) => {
          const postFields = section.fields.map((field) => {
            return {
              ...field,
              value: processedValues[field.name],
            };
          });
          postData.sections.push({
            section_id: section.section_id,
            section_name: section.section_name,
            fields: postFields,
          });
        });
      }

      await onSubmit(postData, formikBag);
    } catch (error) {
      Toast.error("Form submission failed. Please try again.");
    } finally {
      formikBag.setSubmitting(false);
    }
  };

  const getSectionData = (formikValues, section) => {
    const sectionData = {};
    section.fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(formikValues, field.name)) {
        sectionData[field.name] = formikValues[field.name];
      }
    });
    return sectionData;
  };

  const getStatusIcon = (status) => {
    if (!status) return null;

    switch (status.status) {
      case "success":
        return (
          <CheckCircleOutlined style={{ color: "#52c41a", marginLeft: 8 }} />
        );
      case "error":
        return (
          <ExclamationCircleOutlined
            style={{ color: "#ff4d4f", marginLeft: 8 }}
          />
        );
      default:
        return null;
    }
  };

  const get_function = (url, success, params = {}, signal = null) => {
    Axios.get(url, {
      params,
      signal,
      headers: {
        Authorization: `Bearer ${localStorage.getItem("Token")}`,
      },
    })
      .then((res) => {
        success(res);
      })
      .catch((error) => {
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    const allFields =
      formSchema.sections?.flatMap((section) => section.fields || []) || [];

    const tableSubfields = allFields
      .filter((field) => field.type === "table")
      .flatMap((table) => table.fields || []);

    const combinedFields = [...allFields, ...tableSubfields];

    combinedFields.forEach((field) => {
      // Skip fields with API dependencies or {id} placeholder - they will be fetched when dependency value is selected
      const hasApiDependency = field.validation?.apiDependency?.enabled;
      const hasPlaceholder = field.end_point && field.end_point.includes("{id}");

      if (field.dynamic && !hasApiDependency && !hasPlaceholder) {
        get_function(
          `${baseUrl}${field.end_point}`,
          (res) => {
            const options = res.data.data.map((item) => ({
              label: item.name,
              value: item.id,
            }));
            // Use functional update to merge options properly
            setDynamicOptions((prev) => ({
              ...prev,
              [field.name]: options
            }));
          },
          {},
          controller.signal,
        );
      }
    });

    return () => {
      controller.abort();
    };
  }, [formSchema]);
  const signatureRefs = useRef({});

  const upload_document_minio = async (success, data) => {
    const response = await fetch(`${api}/dms/files/upload/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("Token")}`,
      },
      body: data,
    });
    const text = await response.text();
    success(JSON.parse(text));
  };

  const FilePreview = ({ file, onRemove, isImage = false }) => {
    const handlePreview = () => {
      if (file.file_url) {
        window.open(file.file_url, "_blank");
      }
    };

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px",
          border: "1px solid #d9d9d9",
          borderRadius: "6px",
          marginBottom: "8px",
        }}
      >
        {isImage && file.file_url && (
          <img
            src={file.file_url}
            alt={file.file_name}
            style={{
              width: "40px",
              height: "40px",
              objectFit: "cover",
              borderRadius: "4px",
              marginRight: "8px",
            }}
          />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "bold", fontSize: "14px" }}>
            {file.file_name}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            {(file.file_size / 1024).toFixed(1)} KB
          </div>
        </div>
        <Space>
          <Button
            size="small"
            onClick={handlePreview}
            disabled={!file.file_url}
          >
            Preview
          </Button>
          <Button
            size="small"
            danger
            icon={<NxTrash />}
            onClick={onRemove}
          >
            Remove
          </Button>
        </Space>
      </div>
    );
  };

  const handleFileUpload = async (
    file,
    fieldName,
    formik,
    isMultiple = false,
    validation = {},
  ) => {
    try {
      if (validation.maxFileSize) {
        const fileSizeInMB = file.size / 1024 / 1024;
        if (fileSizeInMB > validation.maxFileSize) {
          Toast.error(
            `File size must be less than ${validation.maxFileSize}MB`,
          );
          return;
        }
      }

      if (validation.fileType) {
        const allowedTypes = validation.fileType
          .split(",")
          .map((t) => t.trim());
        const fileExt = file.name.split(".").pop().toLowerCase();
        if (!allowedTypes.includes(fileExt)) {
          Toast.error(`Only ${allowedTypes.join(", ")} files are allowed`);
          return;
        }
      }

      if (validation.resolution && file.type.startsWith("image/")) {
        const [width, height] = validation.resolution.split("x").map(Number);
        const img = new Image();
        img.onload = () => {
          if (img.width !== width || img.height !== height) {
            Toast.error(`Image resolution must be ${validation.resolution}`);
            return;
          }
        };
        img.src = URL.createObjectURL(file);
      }

      if (isMultiple && validation.maxSelection) {
        const currentFiles = formik.values[fieldName] || [];
        if (currentFiles.length >= validation.maxSelection) {
          Toast.error(`Maximum ${validation.maxSelection} files allowed`);
          return;
        }
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("tag", "Form");
      formData.append("name", file.name || "");
      formData.append("file_type", file.type);

      const success_upload_document_minio = (res) => {
        if (res.status === "success") {
          const fileObj = {
            file_id: res.file_id,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            file_url: res.file_url || "",
          };

          if (isMultiple) {
            const currentFiles = formik.values[fieldName] || [];
            const newFiles = [...currentFiles, fileObj];
            formik.setFieldValue(fieldName, newFiles);
          } else {
            formik.setFieldValue(fieldName, fileObj);
          }
          Toast.success("File uploaded successfully!");
        } else {
          Toast.error(res.message || "Upload failed");
        }
      };
      upload_document_minio(success_upload_document_minio, formData);
    } catch (error) {
      Toast.error("Error uploading file");
    }
  };

  const renderField = (field, formik) => {
    const { touched, errors, handleBlur, values } = formik;
    const hasError = touched[field.name] && errors[field.name];

    switch (field.type) {
      case "text":
        return (
          <Input
            {...formik.getFieldProps(field.name)}
            placeholder={field.label}
            onBlur={handleBlur}
            status={hasError ? "error" : ""}
          />
        );

      case "email":
        return (
          <Input
            {...formik.getFieldProps(field.name)}
            placeholder={field.label}
            type="email"
            onBlur={handleBlur}
            status={hasError ? "error" : ""}
          />
        );

      case "password":
        return (
          <Password
            {...formik.getFieldProps(field.name)}
            placeholder={field.label}
            onBlur={handleBlur}
            status={hasError ? "error" : ""}
            iconRender={(visible) =>
              visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
            }
          />
        );

      case "number":
        return (
          <InputNumber
            style={{ width: "100%" }}
            value={values[field.name] === "" ? undefined : values[field.name]}
            onChange={(value) =>
              formik.setFieldValue(field.name, value === null ? "" : value)
            }
            onBlur={handleBlur}
            placeholder={field.label}
            status={hasError ? "error" : ""}
          />
        );

      case "textarea":
        return (
          <TextArea
            {...formik.getFieldProps(field.name)}
            placeholder={field.label}
            rows={4}
            onBlur={handleBlur}
            status={hasError ? "error" : ""}
          />
        );

      case "select": {
        let options = [];
        let isDisabled = false;
        let placeholder = field.label;

        // Check if this field has API dependency
        const apiDep = field.validation?.apiDependency;
        if (apiDep?.enabled && apiDep.dependsOn) {
          const dependencyValue = values[apiDep.dependsOn];

          let valueToUse = null;
          if (dependencyValue) {
            if (typeof dependencyValue === 'object' && dependencyValue.value !== undefined) {
              valueToUse = dependencyValue.value;
            } else if (typeof dependencyValue === 'string' || typeof dependencyValue === 'number') {
              valueToUse = dependencyValue;
            }
          }

          if (valueToUse) {
            const cacheKey = `${field.name}_${valueToUse}`;
            options = (apiDependentOptions[cacheKey] || []).map((opt) => ({
              label: opt.label ?? opt,
              value: opt.value ?? opt,
            }));
          } else {
            isDisabled = true;
            placeholder = `Select ${apiDep.dependsOn} first`;
          }
        } else {
          // Use global dynamic options or static options
          options = (dynamicOptions[field.name] || field.options || []).map(
            (opt) => ({
              label: opt.label ?? opt,
              value: opt.value ?? opt,
            }),
          );
        }

        return (
          <Select
            mode={field.validation?.isMultiple ? "multiple" : undefined}
            value={
              field.validation?.isMultiple
                ? values[field.name]?.map((i) => i.value) || []
                : values[field.name]?.value || null
            }
            onChange={(val, opt) => {
              if (opt) formik.setFieldValue(field.name, opt);
              else
                formik.setFieldValue(
                  field.name,
                  field.validation?.isMultiple ? [] : null,
                );
            }}
            placeholder={placeholder}
            onBlur={handleBlur}
            status={hasError ? "error" : ""}
            style={{ width: "100%" }}
            showSearch={true}
            allowClear={true}
            maxCount={parseInt(field.validation?.maxSelection)}
            options={options}
            disabled={isDisabled}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        );
      }

      case "date":
        return (
          <DatePicker
            style={{ width: "100%" }}
            format="YYYY-MM-DD"
            onChange={(date, dateString) =>
              formik.setFieldValue(field.name, dateString)
            }
            value={values[field.name] ? dayjs(values[field.name], "YYYY-MM-DD") : null}
            onBlur={handleBlur}
            status={hasError ? "error" : ""}
          />
        );

      case "date_range":
        return (
          <RangePicker
            style={{ width: "100%" }}
            format="YYYY-MM-DD"
            onChange={(dates, dateStrings) =>
              formik.setFieldValue(field.name, dateStrings)
            }
            value={
              values[field.name] && values[field.name].length === 2 && values[field.name][0] && values[field.name][1]
                ? [dayjs(values[field.name][0], "YYYY-MM-DD"), dayjs(values[field.name][1], "YYYY-MM-DD")]
                : null
            }
            onBlur={handleBlur}
            status={hasError ? "error" : ""}
          />
        );

      case "time":
        return (
          <TimePicker
            style={{ width: "100%" }}
            onChange={(time, timeString) =>
              formik.setFieldValue(field.name, timeString)
            }
            value={
              values[field.name]
                ? dayjs(values[field.name], "HH:mm:ss")
                : undefined
            }
            onBlur={handleBlur}
            status={hasError ? "error" : ""}
          />
        );

      case "time_range":
        return (
          <TimePicker.RangePicker
            style={{ width: "100%" }}
            onChange={(times, timeStrings) =>
              formik.setFieldValue(field.name, timeStrings)
            }
            value={
              values[field.name] && values[field.name].length === 2
                ? [
                  dayjs(values[field.name][0], "HH:mm:ss"),
                  dayjs(values[field.name][1], "HH:mm:ss"),
                ]
                : undefined
            }
            onBlur={handleBlur}
            status={hasError ? "error" : ""}
          />
        );

      case "file":
      case "image": {
        const currentFiles = values[field.name];
        const isMultiple = field.validation?.isMultiple;
        return (
          <div>
            <Upload
              beforeUpload={(file) => {
                handleFileUpload(file, field.name, formik, isMultiple);
                return false;
              }}
              showUploadList={false}
              multiple={isMultiple}
              accept={field.type === "image" ? "image/*" : undefined}
            >
              <Button icon={<NxUpload />}>
                {isMultiple
                  ? `Upload ${field.type === "image" ? "Images" : "Files"}`
                  : `Upload ${field.type === "image" ? "Image" : "File"}`}
              </Button>
            </Upload>
            <div style={{ marginTop: "12px" }}>
              {isMultiple
                ? Array.isArray(currentFiles) &&
                currentFiles.length > 0 && (
                  <div>
                    <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
                      Uploaded Files ({currentFiles.length}):
                    </div>
                    {currentFiles.map((file, index) => (
                      <FilePreview
                        key={index}
                        file={file}
                        isImage={field.type === "image"}
                        onRemove={() => {
                          const newFiles = currentFiles.filter(
                            (_, i) => i !== index,
                          );
                          formik.setFieldValue(field.name, newFiles);
                        }}
                      />
                    ))}
                  </div>
                )
                : currentFiles && (
                  <div>
                    <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
                      Uploaded File:
                    </div>
                    <FilePreview
                      file={currentFiles}
                      isImage={field.type === "image"}
                      onRemove={() => {
                        formik.setFieldValue(field.name, null);
                      }}
                    />
                  </div>
                )}
            </div>
          </div>
        );
      }
      case "radio": {
        let options = [];
        let isDisabled = false;

        // Check if this field has API dependency
        const apiDep = field.validation?.apiDependency;
        if (apiDep?.enabled && apiDep.dependsOn) {
          const dependencyValue = values[apiDep.dependsOn];

          let valueToUse = null;
          if (dependencyValue) {
            if (typeof dependencyValue === 'object' && dependencyValue.value !== undefined) {
              valueToUse = dependencyValue.value;
            } else if (typeof dependencyValue === 'string' || typeof dependencyValue === 'number') {
              valueToUse = dependencyValue;
            }
          }

          if (valueToUse) {
            const cacheKey = `${field.name}_${valueToUse}`;
            options = apiDependentOptions[cacheKey] || [];
          } else {
            isDisabled = true;
            options = [];
          }
        } else {
          // Use global dynamic options or static options
          options = dynamicOptions[field.name] || field.options || [];
        }

        return (
          <RadioGroup
            onChange={(e) => formik.setFieldValue(field.name, e.target.value)}
            value={values[field.name]}
            onBlur={handleBlur}
            disabled={isDisabled}
          >
            {options.map((opt) => (
              <Radio key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </Radio>
            ))}
          </RadioGroup>
        );
      }

      case "checkbox":
        return (
          <CheckboxGroup
            options={field.options?.map((opt) => ({ label: opt, value: opt }))}
            value={values[field.name]}
            onChange={(checkedValues) =>
              formik.setFieldValue(field.name, checkedValues)
            }
            onBlur={handleBlur}
          />
        );

      case "switch":
        return (
          <Switch
            checked={values[field.name]}
            onChange={(checked) => formik.setFieldValue(field.name, checked)}
            onBlur={handleBlur}
          />
        );

      case "range":
        return (
          <div>
            <Slider
              min={field.validation?.min || 0}
              max={field.validation?.max || 100}
              step={field.validation.step}
              value={values[field.name] || 0}
              onChange={(value) => formik.setFieldValue(field.name, value)}
              onBlur={handleBlur}
              marks={
                field.validation?.step > 1
                  ? {
                    [field.validation?.min || 0]: field.validation?.min || 0,
                    [field.validation?.max || 100]:
                      field.validation?.max || 100,
                  }
                  : undefined
              }
            />
            <div style={{ textAlign: "center", marginTop: 8 }}>
              Value: {values[field.name] || 0}
            </div>
          </div>
        );

      case "color":
        return (
          <ColorPicker
            value={values[field.name]}
            onChange={(color) =>
              formik.setFieldValue(field.name, color.toHexString())
            }
            onBlur={handleBlur}
            showText
            format="hex"
          />
        );

      case "signature":
        return (
          <div
            style={{
              border: "1px solid #d9d9d9",
              borderRadius: "6px",
              padding: "8px",
              width: "100%",
            }}
          >
            <SignatureCanvas
              ref={(ref) => {
                if (ref) {
                  signatureRefs.current[field.name] = ref;
                }
              }}
              canvasProps={{
                className: "signature-canvas",
                style: {
                  border: "1px dashed #ccc",
                  borderRadius: "4px",
                  height: "200px",
                  width: "100%",
                },
              }}
              onEnd={() => {
                if (signatureRefs.current[field.name]) {
                  const dataUrl = signatureRefs.current[field.name].toDataURL();
                  formik.setFieldValue(field.name, dataUrl);
                }
              }}
            />
            <div style={{ marginTop: 8, textAlign: "center" }}>
              <Button
                size="small"
                onClick={() => {
                  if (signatureRefs.current[field.name]) {
                    signatureRefs.current[field.name].clear();
                    formik.setFieldValue(field.name, "");
                  }
                }}
              >
                Clear Signature
              </Button>
            </div>
          </div>
        );

      case "richtext":
        return (
          <ReactQuill
            value={values[field.name]}
            onChange={(content) => {
              formik.setFieldValue(field.name, content);
            }}
            placeholder={field.label}
            style={{
              minHeight: "120px",
              ...(hasError ? { border: "1px solid #ff4d4f" } : {}),
            }}
            modules={{
              toolbar: [
                [{ header: [1, 2, false] }],
                ["bold", "italic", "underline", "strike", "blockquote"],
                [
                  { list: "ordered" },
                  { list: "bullet" },
                  { indent: "-1" },
                  { indent: "+1" },
                ],
                ["link", "image"],
                ["clean"],
              ],
            }}
            formats={[
              "header",
              "bold",
              "italic",
              "underline",
              "strike",
              "blockquote",
              "list",
              "bullet",
              "indent",
              "link",
              "image",
            ]}
          />
        );

      case "table":
        return (
          <TableViewer field={field} formik={formik} />
        );

      default:
        return (
          <Input
            {...formik.getFieldProps(field.name)}
            placeholder={field.label}
            onBlur={handleBlur}
            status={hasError ? "error" : ""}
          />
        );
    }
  };

  // Width mapping for field layout - uses configured width if available
  const getFieldSpan = (field) => {
    // If field has a configured width, use it
    if (field.width) {
      const widthMap = {
        "25": { xs: 24, sm: 12, md: 6 },
        "33": { xs: 24, sm: 12, md: 8 },
        "50": { xs: 24, sm: 24, md: 12 },
        "66": { xs: 24, sm: 24, md: 16 },
        "75": { xs: 24, sm: 24, md: 18 },
        "100": { xs: 24, sm: 24, md: 24 },
      };
      return widthMap[field.width] || { xs: 24, sm: 12, md: 8 };
    }

    // Fallback: auto-detect based on field type
    const fullWidthTypes = [
      "table",
      "textarea",
      "checkbox",
      "radio",
      "file",
      "image",
      "signature",
      "richtext",
      "date_range",
      "time_range",
    ];
    if (fullWidthTypes.includes(field.type)) {
      return { xs: 24, sm: 24, md: 24 };
    }
    if (field.type === "select" && field.validation?.isMultiple) {
      return { xs: 24, sm: 24, md: 12 };
    }
    return { xs: 24, sm: 12, md: 8 };
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleWholeFormSubmit}
      validateOnChange={true}
      validateOnBlur={true}
      enableReinitialize
    >
      {(formik) => (
        <>
          <ApiDependencyMonitor
            formSchema={formSchema}
            formValues={formik.values}
            fetchApiDependentOptions={fetchApiDependentOptions}
            setFieldValue={formik.setFieldValue}
          />
        <FormikForm>
          <Form layout="vertical">
            {formSchema?.sections &&
              formSchema.sections
                .filter(section => isSectionVisible(section, formSchema.sections || [], formik.values))
                .map((section, idx) => {
                return (
                  <div key={idx} className="my-4 border border-gray-200 p-4 rounded-lg">
                    <div className="space-y-4">
                      <Row gutter={[16, 16]}>
                        {section.fields
                          .filter(field => isFieldVisible(field, formSchema.sections || [], formik.values))
                          .map((field, fidx) => (
                          <Col key={fidx} {...getFieldSpan(field)}>
                            <Form.Item
                              label={field.label}
                              required={field.required}
                              validateStatus={
                                formik.errors[field.name] &&
                                  formik.touched[field.name]
                                  ? "error"
                                  : ""
                              }
                              help={
                                formik.errors[field.name] &&
                                  formik.touched[field.name]
                                  ? getDynamicTableErrorMessage(
                                    formik.errors[field.name],
                                  )
                                  : ""
                              }
                            >
                              {renderField(field, formik)}
                            </Form.Item>
                          </Col>
                        ))}
                      </Row>
                    </div>
                  </div>
                );
              })}

            {/* {!isSectionSubmission && (
              <div className="my-3 flex justify-end space-x-6 mt-8 pt-8 border-t-2 border-gray-100">
                <Button
                  size="large"
                  onClick={() => {
                    formik.resetForm();
                    Object.keys(signatureRefs.current || {}).forEach(
                      (fieldName) => {
                        if (signatureRefs.current[fieldName]) {
                          signatureRefs.current[fieldName].clear();
                        }
                      }
                    );
                  }}
                >
                  Reset
                </Button>

                <Button
                  type="primary"
                  size="large"
                  loading={formik.isSubmitting}
                  onClick={() => {
                    formik.handleSubmit();
                  }}
                >
                  {submitText}
                </Button>
              </div>
            )} */}
          </Form>
        </FormikForm>
        </>
      )}
    </Formik>
  );
};

export default PreviewFieldGroupBuilder;
