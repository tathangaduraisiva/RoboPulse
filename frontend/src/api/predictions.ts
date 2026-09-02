import { apiClient } from './client';
import type { PredictionInsight } from '../types/prediction';
import type { ApiResponse } from '../types/api';

export async function fetchPredictions(): Promise<PredictionInsight[]> {
  const response = await apiClient.get<ApiResponse<PredictionInsight[]>>('/predictions');
  return response.data.data;
}
