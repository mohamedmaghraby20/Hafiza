export interface ImportCard {
  readonly front: string;
  readonly back: string;
  readonly tags: readonly string[];
  readonly row: number;
}

export interface ImportIssue {
  readonly row: number;
  readonly message: string;
}

export interface ImportPreview {
  readonly fileName: string;
  readonly cards: readonly ImportCard[];
  readonly issues: readonly ImportIssue[];
}

export interface ImportAdapter {
  parse(fileName: string, content: string): ImportPreview;
}
