import { apiClient } from './client';
import type { ApiResponse } from '../types/api';
import type { ProductionLine } from '../types/productionLine';

export async function fetchProductionLines(): Promise<ProductionLine[]> {
  const response = await apiClient.get<ApiResponse<ProductionLine[]>>('/production-lines');
  return response.data.data;
}
