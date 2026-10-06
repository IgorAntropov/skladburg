export interface CommentDetectorValue {
  find: (source: string) => number[];
  kind: string;
}
