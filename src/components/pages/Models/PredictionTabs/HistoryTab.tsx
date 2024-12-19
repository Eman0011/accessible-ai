import {
    Box,
    Button,
    Container,
    Header,
    Link,
    Pagination,
    SegmentedControl,
    SpaceBetween,
    StatusIndicator,
    Table
} from '@cloudscape-design/components';
import React from 'react';
import { Prediction } from '../../../../types/models';
import tableStyles from '../../../common/TableStyles.module.css';
import { BatchResultsTable } from '../components/BatchResultsTable';
import { JsonOutput } from '../components/JsonOutput';

interface HistoryTabProps {
    predictions: Prediction[];
    loading: boolean;
    predictionTypeFilter: 'all' | 'ADHOC' | 'BATCH';
    setPredictionTypeFilter: (filter: 'all' | 'ADHOC' | 'BATCH') => void;
    paginationProps: {
        currentPageIndex: number;
        onChange: ({ detail }: { detail: { currentPageIndex: number } }) => void;
        pagesCount: number;
    };
    onCopyPrediction: (prediction: Prediction) => void;
    selectedPrediction?: Prediction;
    onSelectionChange: (prediction: Prediction | undefined) => void;
    onRefresh: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
    predictions,
    loading,
    predictionTypeFilter,
    setPredictionTypeFilter,
    paginationProps,
    onCopyPrediction,
    selectedPrediction,
    onSelectionChange,
    onRefresh
}) => {
    const renderPredictionDetails = (prediction: Prediction) => {
        if (prediction.type === 'BATCH' && prediction.outputDataPath) {
            return (
                <BatchResultsTable
                    results={[]}
                    targetFeature={prediction.modelVersion?.targetFeature || ''}
                    outputPath={prediction.outputDataPath}
                />
            );
        }
        return null;
    };

    return (
        <SpaceBetween size="l">
            <Container>
                <SpaceBetween size="m">
                    <Header
                        variant="h2"
                        actions={
                            <SpaceBetween direction="horizontal" size="xs">
                                <Button
                                    onClick={onRefresh}
                                    iconName="refresh"
                                    loading={loading}
                                />
                                <SegmentedControl
                                    selectedId={predictionTypeFilter}
                                    onChange={({ detail }) => 
                                        setPredictionTypeFilter(detail.selectedId as typeof predictionTypeFilter)
                                    }
                                    label="Filter by type"
                                    options={[
                                        { id: 'all', text: 'All' },
                                        { id: 'ADHOC', text: 'Ad-hoc' },
                                        { id: 'BATCH', text: 'Batch' }
                                    ]}
                                />
                            </SpaceBetween>
                        }
                    >
                        Prediction History
                    </Header>

                    <Table
                        className={tableStyles.table}
                        columnDefinitions={[
                            {
                                id: 'timestamp',
                                header: 'Timestamp',
                                cell: item => new Date(item.createdAt || '').toLocaleString(),
                                sortingField: 'createdAt',
                                minWidth: 150
                            },
                            {
                                id: 'type',
                                header: 'Type',
                                cell: item => item.type,
                                minWidth: 100
                            },
                            {
                                id: 'status',
                                header: 'Status',
                                cell: item => (
                                    <StatusIndicator type={
                                        item.status === 'COMPLETED' ? 'success' :
                                        item.status === 'FAILED' ? 'error' :
                                        item.status === 'RUNNING' ? 'in-progress' :
                                        'pending'
                                    }>
                                        {item.status}
                                    </StatusIndicator>
                                ),
                                minWidth: 100
                            },
                            {
                                id: 'result',
                                header: 'Result',
                                cell: item => {
                                    if (item.status !== 'COMPLETED') return '-';
                                    
                                    if (item.type === 'ADHOC') {
                                        try {
                                            const output = JSON.parse(item.adhocOutput || '{}');
                                            if (output.statusCode === 500) {
                                                return <StatusIndicator type="error">Failed</StatusIndicator>;
                                            }
                                            return <JsonOutput data={output} />;
                                        } catch (e) {
                                            return 'Error parsing result';
                                        }
                                    }
                                    return (
                                        <Link href={item.outputDataPath}>
                                            Download CSV
                                        </Link>
                                    );
                                },
                                minWidth: 200
                            },
                            {
                                id: 'input',
                                header: 'Input',
                                cell: item => {
                                    if (item.type === 'BATCH') {
                                        return item.inputDataPath?.split('/').pop() || '-';
                                    }
                                    try {
                                        const input = JSON.parse(item.adhocInput || '{}');
                                        return JSON.stringify(input);
                                    } catch (e) {
                                        return 'Error parsing input';
                                    }
                                },
                                minWidth: 200
                            },
                            {
                                id: 'actions',
                                header: 'Actions',
                                cell: item => (
                                    item.type === 'ADHOC' && (
                                        <Button
                                            onClick={() => onCopyPrediction(item)}
                                            iconName="copy"
                                        >
                                            Copy Prediction
                                        </Button>
                                    )
                                ),
                                minWidth: 150
                            }
                        ]}
                        items={predictions}
                        loading={loading}
                        loadingText="Loading predictions..."
                        resizableColumns
                        selectionType="single"
                        selectedItems={selectedPrediction ? [selectedPrediction] : []}
                        onSelectionChange={({ detail }) => 
                            onSelectionChange(detail.selectedItems[0])
                        }
                        onRowClick={({ detail }) => 
                            onSelectionChange(detail.item)
                        }
                        pagination={<Pagination {...paginationProps} />}
                        variant="embedded"
                        empty={
                            <Box textAlign="center" color="inherit">
                                <b>No predictions</b>
                                <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                                    No predictions have been made yet.
                                </Box>
                            </Box>
                        }
                    />
                </SpaceBetween>
            </Container>

            {selectedPrediction?.type === 'BATCH' && (
                <Container
                    header={
                        <Header variant="h2">
                            Prediction Details
                        </Header>
                    }
                >
                    {renderPredictionDetails(selectedPrediction)}
                </Container>
            )}
        </SpaceBetween>
    );
}; 