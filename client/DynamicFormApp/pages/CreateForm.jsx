import React from "react";
import FormBuilder from "./FormBuilder";
import FormViewer from "./FormViewer";

function CreateForm() {
  return (
    <div className="flex flex-col space-y-12">
      <FormBuilder />
      {/* <FormViewer /> */}
    </div>
  );
}

export default CreateForm;
