export interface CustomResponse<T> {
    result: 'success' | 'error';
    error_msg?: string;
    data?: T;
}
