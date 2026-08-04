export type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | object | null;
  token?: string;
};
