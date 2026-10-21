import type { DescService } from '@bufbuild/protobuf';
import type { Client } from '@connectrpc/connect';

export interface ApiClient {
  service: <TService extends DescService>(service: TService) => Client<TService>;
}
