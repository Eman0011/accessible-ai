import { FileUploader } from '@aws-amplify/ui-react-storage';
import { FormField, Table, Box, SpaceBetween } from '@cloudscape-design/components';
import React, { useState } from 'react';
import Papa from 'papaparse';

interface BatchFormProps {
    uploadBasePath: string;
    onFileProcessed: (file: File | null) => void;
    isLoading: boolean;
}

export const BatchForm: React.FC<BatchFormProps> = ({
    uploadBasePath,
    onFileProcessed,
    isLoading
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
            uploadBasePath,
            fullPath: `${uploadBasePath}/${file.name}`
        });

        setFile(file);
        setIsFileSelected(true);
        onFileProcessed(file);
        
        Papa.parse(file, {
            preview: 5,
            complete: (results) => {
                console.debug('[BatchForm] CSV preview parsed:', {
                    totalRows: results.data.length,
                    headers: results.data[0],
                    sampleData: results.data.slice(1, 3),
                    errors: results.errors,
                    meta: results.meta
                });

                if (results.data.length > 0) {
                    const headers = results.data[0] as string[];
                    const rows = results.data.slice(1) as string[][];
                    setPreviewData({ headers, rows });
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
                        const key = `${uploadBasePath}/${file.name}`;
                        console.debug('[BatchForm] FileUploader processing file:', {
                            fileName: file.name,
                            fileSize: file.size,
                            path: uploadBasePath,
                            key,
                            timestamp: new Date().toISOString()
                        });
                        return { file, key };
                    }}
                    onError={(error: unknown) => {
                        console.error('[BatchForm] FileUploader error:', {
                            error,
                            timestamp: new Date().toISOString()
                        });
                        resetForm();
                    }}
                    onSuccess={() => {
                        console.debug('[BatchForm] File uploaded successfully', {
                            fileName: file?.name,
                            timestamp: new Date().toISOString()
                        });
                    }}
                    onFileRemove={() => {
                        console.debug('[BatchForm] File removed');
                        resetForm();
                    }}
                    onClear={() => {
                        console.debug('[BatchForm] Upload cleared');
                        resetForm();
                    }}
                />
            </FormField>

            {isFileSelected && file && previewData.headers.length > 0 && (
                <div>
                    <Box variant="awsui-key-label">Data Preview</Box>
                    <Table
                        columnDefinitions={previewData.headers.map(header => ({
                            id: header,
                            header: header,
                            cell: item => item[header] || '-'
                        }))}
                        items={previewData.rows.map(row => 
                            previewData.headers.reduce((acc, header, index) => ({
                                ...acc,
                                [header]: row[index]
                            }), {})
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
                </div>
            )}
        </SpaceBetween>
    );
}; 