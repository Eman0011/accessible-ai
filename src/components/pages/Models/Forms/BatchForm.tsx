import { FileUploader } from '@aws-amplify/ui-react-storage';
import { Box, FormField, Header, SpaceBetween, Table } from '@cloudscape-design/components';
import Papa from 'papaparse';
import React, { useState } from 'react';

interface BatchFormProps {
    uploadBasePath: string;
    onFileProcessed: (file: File | null) => void;
    isLoading: boolean;
    onDataParsed?: (data: string[][]) => void;
}

// Define an interface for the table data
interface TableItem {
    [key: string]: string;
}

export const BatchForm: React.FC<BatchFormProps> = ({
    uploadBasePath,
    onFileProcessed,
    onDataParsed
}) => {
    const [previewData, setPreviewData] = useState<{ headers: string[], rows: string[][] }>({
        headers: [],
        rows: []
    });
    const [file, setFile] = useState<File | null>(null);
    const [isFileSelected, setIsFileSelected] = useState(false);

    const handleFileSelect = async (file: File) => {
        console.debug('[BatchForm] Processing batch file:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            lastModified: new Date(file.lastModified).toISOString(),
            uploadBasePath
        });

        setFile(file);
        setIsFileSelected(true);
        onFileProcessed(file);
        
        Papa.parse(file, {
            preview: 11, // Changed to 11 to show header + 10 data rows
            complete: (results) => {
                console.debug('[BatchForm] CSV preview parsed:', {
                    totalRows: results.data.length,
                    headers: results.data[0],
                    sampleData: results.data.slice(1, 11),
                    errors: results.errors,
                    meta: results.meta
                });

                if (results.data.length > 0) {
                    const headers = results.data[0] as string[];
                    const rows = results.data.slice(1) as string[][];
                    setPreviewData({ headers, rows });
                    onDataParsed?.(results.data as string[][]);
                }
            },
            error: (error) => {
                console.error('[BatchForm] Error parsing CSV:', error);
            }
        });
    };

    const resetForm = () => {
        console.debug('[BatchForm] Resetting form state');
        setFile(null);
        setIsFileSelected(false);
        setPreviewData({ headers: [], rows: [] });
        onFileProcessed(null);
    };

    return (
        <SpaceBetween size="m">
            <FormField>
                <FileUploader
                    path={uploadBasePath}
                    acceptedFileTypes={['.csv']}
                    maxFileCount={1}
                    processFile={async ({ file }) => {
                        await handleFileSelect(file);
                        const key = file.name;
                        console.debug('[BatchForm] FileUploader processing file:', {
                            fileName: file.name,
                            fileSize: file.size,
                            path: uploadBasePath,
                            key,
                            timestamp: new Date().toISOString()
                        });
                        return { file, key };
                    }}
                    onUploadSuccess={() => {
                        console.debug('[BatchForm] File uploaded successfully', {
                            fileName: file?.name,
                            timestamp: new Date().toISOString()
                        });
                    }}
                    onFileRemove={() => {
                        console.debug('[BatchForm] File removed');
                        resetForm();
                    }}
                />
            </FormField>

            {isFileSelected && file && previewData.headers.length > 0 && (
                <Box padding={{ top: 'xl' }}>
                    <Header variant="h3">Input Data Preview</Header>
                    <Table<TableItem>
                        columnDefinitions={previewData.headers.map(header => ({
                            id: header,
                            header: header,
                            cell: (item: TableItem) => item[header] || '-'
                        }))}
                        items={previewData.rows.map(row => 
                            previewData.headers.reduce((acc, header, index) => ({
                                ...acc,
                                [header]: row[index]
                            }), {} as TableItem)
                        )}
                        variant="embedded"
                        stripedRows
                        empty={
                            <Box textAlign="center" color="inherit">
                                <b>No data</b>
                                <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                                    Upload a CSV file to see a preview.
                                </Box>
                            </Box>
                        }
                    />
                </Box>
            )}
        </SpaceBetween>
    );
}; 