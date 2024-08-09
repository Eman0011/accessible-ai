import { StorageManager } from '@aws-amplify/ui-react-storage';
import { generateClient } from "aws-amplify/api";
import { Card } from 'primereact/card';
import React, { useEffect, useRef, useState } from 'react';
import type { Schema } from "../../../../amplify/data/resource";

import Papa from 'papaparse';

import {
  Button,
  Form,
  FormField,
  Header,
  Select,
  SpaceBetween,
  Table,
  TableProps,
} from '@cloudscape-design/components';


const client = generateClient<Schema>();


const FileUploader: React.FC = () => {
  const [file, setFile] = useState<any>();
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [displayData, setDisplayData] = useState<any[]>([]);
  const [columns, setColumns] = useState<TableProps.ColumnDefinition<any>[]>([]);
  const [zoom, setZoom] = useState(1);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const fileUploadRef = useRef<any>(null);

  const [response, setResponse] = useState({})

  const reset = () => {
    setFile(null);
    setParsedData([]);
    setDisplayData([]);
    setColumns([]);
    setZoom(1);
    setSelectedColumn(null);
    if (fileUploadRef.current) {
      fileUploadRef.current.clear();
    }
  };

  // const emptyTemplate = () => {
  //   return (
  //     <div onClick={() => fileUploadRef.current.getInput().click()} style={{ cursor: 'pointer' }}>
  //       <div className="centered">
  //         <i className="pi pi-image mt-3 p-5" style={{ fontSize: '10em', borderRadius: '50%', backgroundColor: 'var(--surface-b)', color: 'var(--surface-d)' }}></i>
  //       </div>
  //       <span style={{ fontSize: '1.2em', color: 'var(--text-color-secondary)' }} className="centered">
  //         Drag and Drop File Here
  //       </span>
  //     </div>
  //   );
  // };

  const updateTable = (data: any, selectedCol: string | null = null) => {
    const cols = Object.keys(data[0]).map((col, index) => ({
      id: col,
      header: (
        <div style={col === selectedCol ? {
          backgroundColor: '#037f0c', textAlign: 'center', color: 'white', padding: '10px'
        } : { textAlign: 'center', padding: '10px' }}>
          {col}
        </div>
      ),
      cell: (item: any) => (
        <div style={col === selectedCol ? {
          backgroundColor: '#037f0c', color: 'white', textAlign: 'center', paddingLeft: index === 0 ? '10px' : '0'
        } : { textAlign: 'center', paddingLeft: index === 0 ? '10px' : '0' }}>
          {item[col]}
        </div>
      ),
    }));
    setColumns(cols);
    setParsedData(data);
    setDisplayData(data.slice(0, 5)); // Display first 5 rows
  };

  // const onSelect = (e: any) => {
  //   const file = e.files[0];
  //   if (file) {
  //     setFile(file);
  //     Papa.parse(file, {
  //       header: true,
  //       skipEmptyLines: true,
  //       complete: (results: any) => updateTable(results.data, selectedColumn),
  //       error: (error: any) => {
  //         console.error('Error parsing file:', error);
  //       },
  //     });
  //   }
  // };

  const processFile = async ({ file }: any) => {
    console.log("Process File!");
    setFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        updateTable(results.data, selectedColumn);
      },
      error: (error) => {
        console.error('Error parsing file:', error);
      },
    });
    return { file, key: `${file.name}` };
  };

  const handleZoomIn = () => {
    setZoom(prevZoom => Math.min(prevZoom + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom(prevZoom => Math.max(prevZoom - 0.1, 0.5));
  };

  const handleColumnSelect = ({ detail }: any) => {
    const selectedValue = detail.selectedOption.value;
    setSelectedColumn(selectedValue);
    updateTable(parsedData, selectedValue);
  };

  // const headerTemplate = (options: any) => {
  //   const { className, chooseButton } = options;
  //   return (
  //       <div className={className} style={{ backgroundColor: 'transparent', display: 'flex', alignItems: 'center' }}>
  //           {chooseButton}
  //           {!file  && (
  //               <div>
  //                   Upload a File
  //               </div>
  //           )}
  //       </div>
  //   );
  // };

  const submitTrainingJob = async () => {
    try {
      const result = await client.queries.runTrainingJob({
        submittedBy: "eman",
        fileUrl: `example-training-data/${file.name}`,
        targetFeature: selectedColumn,
      });
      console.log("RESULT:")
      console.log(result)
      if (result.data) {
        console.log(result.data)
        setResponse(result.data);
      }
    } catch (error) {
      console.error('Error submitting training job:', error);
    }
  };

  useEffect(() => {
    if (tableRef.current) {
      const tableHeight = tableRef.current.scrollHeight;
      tableRef.current.style.height = `${tableHeight * zoom}px`;
    }
  }, [zoom]);

  // const chooseOptions = { 
  //   icon: 'pi pi-fw pi-images',
  //    iconOnly: false, 
  //    className: 'custom-choose-btn p-button-rounded p-button-outlined' 
  //   };

  return (
    <SpaceBetween size='m'>
      {/* <Card title="File Upload">
        <Tooltip target=".custom-choose-btn" content="Choose" position="bottom" />
        <FileUpload 
          ref={fileUploadRef}
          name="File Select" 
          multiple={false} 
          accept=".csv, .tsv, text/csv, text/tab-separated-values" 
          maxFileSize={1000000}
          onSelect={onSelect}
          chooseLabel='Choose File'
          emptyTemplate={emptyTemplate} 
          onClear={reset}
          onRemove={reset} // Trigger reset when the file is removed
          headerTemplate={headerTemplate}
          chooseOptions={chooseOptions}
        />
      </Card> */}
      <Card>
        <StorageManager
          acceptedFileTypes={['.csv', '.tsv', 'text/csv', 'text/tab-separated-values']}
          path="example-training-data/"
          processFile={processFile}
          maxFileCount={1}
          isResumable
        />
      </Card>
      {parsedData.length > 0 && (
        <Form>
          <SpaceBetween size='s'>
            <FormField label="Choose Target Column">
              <Select
                placeholder="Select target column"
                onChange={handleColumnSelect}
                selectedOption={{ label: selectedColumn || 'Select a column', value: selectedColumn || '' }}
                options={columns.map(col => ({ label: col.header as string, value: col.id }))}
              />
            </FormField>
            <div>
              <Button onClick={handleZoomIn}>Zoom In</Button>
              <Button onClick={handleZoomOut}>Zoom Out</Button>
            </div>
            <div style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
              <div ref={tableRef} style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', display: 'inline-block' }}>
                <Table
                  columnDefinitions={columns}
                  items={displayData}
                  resizableColumns
                  stickyHeader
                  header={<Header>{file.name}</Header>}
                />
              </div>
            </div>
            <FormField>
              <Button variant="primary" onClick={submitTrainingJob} disabled={!selectedColumn}>Generate AI Model</Button>
              <span style={{ 'paddingLeft': '10px' }}><Button onClick={reset}>Cancel</Button></span>
            </FormField>
          </SpaceBetween>
        </Form>
      )}
    </SpaceBetween>
  );
};

export default FileUploader;
