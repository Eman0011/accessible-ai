import { Box, Link, StatusIndicator } from '@cloudscape-design/components';
import { TableProps } from '@cloudscape-design/components/table';
import { Prediction } from '../../../types/models';

export const PredictionTableColumns: TableProps.ColumnDefinition<Prediction>[] = [
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
                    return Array.isArray(output.body) ? output.body[0] : output.body;
                } catch (e) {
                    return 'Error parsing result';
                }
            }
            return (
                <Link href={item.outputDataPath}>
                    Download CSV
                </Link>
            );
        }
    },
    {
        id: 'input',
        header: 'Input',
        cell: item => {
            if (item.type === 'ADHOC') {
                try {
                    const input = JSON.parse(item.adhocInput || '{}');
                    return <Box>{Object.entries(input)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ')}
                    </Box>;
                } catch (e) {
                    return 'Error parsing input';
                }
            }
            return item.inputDataPath?.split('/').pop() || '-';
        }
    },
    {
        id: 'latency',
        header: 'Latency',
        cell: item => item.inferenceLatency ? `${item.inferenceLatency}ms` : '-'
    }
]; 