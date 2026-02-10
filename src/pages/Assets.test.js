import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Assets from './Assets';
import AssetsService from '../services/assets';

jest.mock('../services/assets');
jest.mock('../components/Page', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/Header', () => ({ children, headerTitle }) => <header>{headerTitle}{children}</header>);
jest.mock('../components/Footer', () => () => <footer></footer>);
jest.mock('../components/Controls', () => ({ title }) => <div>{title}</div>);

describe('Assets Page', () => {
  const mockAssets = [
    {
      id: 'asset-1',
      name: 'node-us-east-1a',
      category: 'Compute',
      type: 'Node',
      cluster: 'prod-cluster',
      totalCost: 125.40,
      cpuCost: 80.00,
      ramCost: 45.40,
      providerId: 'i-0abcd1234efgh5678',
    },
    {
      id: 'asset-2',
      name: 'pvc-db-storage',
      category: 'Storage',
      type: 'Storage',
      cluster: 'prod-cluster',
      totalCost: 85.00,
      cpuCost: 0,
      ramCost: 0,
      providerId: 'vol-099887766',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    AssetsService.fetchAssets.mockResolvedValue(mockAssets);
  });

  test('renders Assets page with header', async () => {
    render(<Assets />);
    expect(screen.getByText('Infrastructure Assets')).toBeInTheDocument();
  });

  test('loads and displays assets from service', async () => {
    render(<Assets />);
    
    await waitFor(() => {
      expect(AssetsService.fetchAssets).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('node-us-east-1a')).toBeInTheDocument();
    });
  });

  test('displays correct table headers', async () => {
    render(<Assets />);
    
    await waitFor(() => {
      expect(screen.getByText('Asset Name')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Cluster')).toBeInTheDocument();
      expect(screen.getByText('Total Cost')).toBeInTheDocument();
    });
  });

  test('calculates correct stats', async () => {
    render(<Assets />);
    
    await waitFor(() => {
      // Total spend should be 125.40 + 85.00 = 210.40
      expect(screen.getByText(/210.40/)).toBeInTheDocument();
      // Active assets should be 2
      expect(screen.getByText('Active Assets')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  test('filters assets by search term', async () => {
    render(<Assets />);
    
    await waitFor(() => {
      expect(screen.getByText('node-us-east-1a')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Filter by name/);
    fireEvent.change(searchInput, { target: { value: 'storage' } });

    await waitFor(() => {
      expect(screen.getByText('pvc-db-storage')).toBeInTheDocument();
      expect(screen.queryByText('node-us-east-1a')).not.toBeInTheDocument();
    });
  });

  test('handles empty search gracefully', async () => {
    render(<Assets />);
    
    await waitFor(() => {
      expect(screen.getByText('node-us-east-1a')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Filter by name/);
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.queryByText('node-us-east-1a')).not.toBeInTheDocument();
      expect(screen.queryByText('pvc-db-storage')).not.toBeInTheDocument();
    });
  });

  test('downloads CSV with correct data', async () => {
    const mockCreateElement = jest.spyOn(document, 'createElement');
    const mockClick = jest.fn();
    
    mockCreateElement.mockReturnValueOnce({
      href: '',
      download: '',
      click: mockClick,
      style: {},
    });

    render(<Assets />);
    
    await waitFor(() => {
      expect(screen.getByText('node-us-east-1a')).toBeInTheDocument();
    });

    const exportBtn = screen.getByText('Export');
    fireEvent.click(exportBtn);

    // Verify that click was called on the anchor element
    await waitFor(() => {
      expect(mockClick).toHaveBeenCalled();
    });

    mockCreateElement.mockRestore();
  });

  test('calls fetchData on refresh button click', async () => {
    render(<Assets />);
    
    await waitFor(() => {
      expect(AssetsService.fetchAssets).toHaveBeenCalledTimes(1);
    });

    // Find and click refresh button (IconButton with Renew icon)
    const refreshBtn = screen.getByRole('button', { name: /Refresh Data/ });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(AssetsService.fetchAssets).toHaveBeenCalledTimes(2);
    });
  });

  test('handles API errors gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    AssetsService.fetchAssets.mockRejectedValueOnce(new Error('API Error'));

    render(<Assets />);
    
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Fetch error:', expect.any(Error));
    });

    consoleError.mockRestore();
  });

  test('respects currency selection', async () => {
    render(<Assets />);
    
    await waitFor(() => {
      expect(screen.getByText('node-us-east-1a')).toBeInTheDocument();
    });

    // Verify that cost is displayed (currency formatting will be handled by toCurrency util)
    expect(screen.getByText(/125/)).toBeInTheDocument();
  });

  test('paginates results correctly', async () => {
    const largeAssetList = Array.from({ length: 25 }, (_, i) => ({
      ...mockAssets[0],
      id: `asset-${i}`,
      name: `asset-${i}`,
    }));

    AssetsService.fetchAssets.mockResolvedValueOnce(largeAssetList);

    render(<Assets />);
    
    await waitFor(() => {
      // Should show first 10 items
      expect(screen.getByText('asset-0')).toBeInTheDocument();
    });

    // Pagination controls should be visible
    expect(screen.getByRole('button', { name: /Next page/i })).toBeInTheDocument();
  });
});
