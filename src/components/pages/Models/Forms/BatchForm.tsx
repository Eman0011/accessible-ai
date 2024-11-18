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
        console.debug('Processing batch file:', {
            fileName: file.name,
            fileSize: file.size,
            uploadBasePath,
            fullPath: `${uploadBasePath}/${file.name}`
        });

        setFile(file);
        setIsFileSelected(true);
        onFileProcessed(file);
        
        Papa.parse(file, {
            preview: 5,
            complete: (results) => {
                console.debug('CSV preview parsed:', {
                    rowCount: results.data.length,
                    firstRow: results.data[0]
                });

                if (results.data.length > 0) {
                    const headers = results.data[0] as string[];
                    const rows = results.data.slice(1) as string[][];
                    setPreviewData({ headers, rows });
                }
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
            }
        });
    };

    const resetForm = () => {
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
                        console.debug('FileUploader processing file:', {
                            file: file.name,
                            path: uploadBasePath,
                            key: `${uploadBasePath}/${file.name}`
                        });
                        return { 
                            file, 
                            key: `${uploadBasePath}/${file.name}`
                        };
                    }}
                    accessLevel="private"
                    onError={(error) => {
                        console.error('FileUploader error:', error);
                        resetForm();
                    }}
                    onSuccess={() => {
                        console.debug('File uploaded successfully');
                    }}
                    onFileRemove={resetForm}
                    onClear={resetForm}
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