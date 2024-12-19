import { Box } from '@cloudscape-design/components';
import Papa from 'papaparse';
import React, { useEffect, useState } from 'react';
import DatasetVisualizer from '../../../common/DatasetVisualizer';
import { getCSVFromS3 } from '../../../common/utils/S3Utils';

interface BatchResultsTableProps {
    results: Array<{
        index: number;
        prediction: string;
    }>;
    targetFeature: string;
    outputPath: string;
}

export const BatchResultsTable: React.FC<BatchResultsTableProps> = ({ 
    targetFeature, 
    outputPath
}) => {
    const [tableData, setTableData] = useState<Array<{ id: string; prediction: string }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [columns, setColumns] = useState<any[]>([]);

    useEffect(() => {
        const fetchPreviewData = async () => {
            if (!outputPath) {
                console.debug('No output path provided');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                
                console.debug('Fetching prediction results preview:', {
                    outputPath,
                    targetFeature
                });

                // Get preview data (first 100KB or so)
                const { data, meta } = await getCSVFromS3(outputPath, { 
                    preview: true,
                    previewRows: 10 // Limit to 10 rows for preview
                });

                setPreviewData(data);
                
                // Set columns if available from meta
                if (meta.fields) {
                    setColumns(meta.fields.map(field => ({
                        id: field,
                        header: field,
                        cell: (item: any) => item[field]?.toString() || '-'
                    })));
                }

                const formattedData = data.map((row: any, index) => ({
                    id: row.id || `Row ${index + 1}`,
                    prediction: row.prediction
                }));

                setTableData(formattedData);
            } catch (error) {
                console.error('Error fetching prediction results:', {
                    error,
                    outputPath,
                    targetFeature
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchPreviewData();
    }, [outputPath]);

    const handleDownload = async () => {
        if (!outputPath) return;

        try {
            // Get the full dataset
            const { data } = await getCSVFromS3(outputPath, { preview: false });
            const csv = Papa.unparse(data);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'predictions.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading file:', error);
        }
    };

    if (isLoading) {
        return (
            <Box textAlign="center" color="inherit">
                <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                Loading prediction results...
                </Box>
            </Box>
        );
    }

    return (
        <Box>
            <DatasetVisualizer
                dataset={{
                    name: 'Batch Prediction Results',
                    description: `Results for ${targetFeature}`,
                    owner: 'System',
                    projectId: 'project-id',
                    id: 'batch-results-id'
                }}
                s3Path={outputPath}
                preview={true}
                previewData={previewData}
                columns={columns}
                onDownloadFull={handleDownload}
            />
        </Box>
    );
}; 