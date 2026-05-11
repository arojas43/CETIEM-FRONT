export type CogneeDomain = 'industria' | 'construccion' | 'tecnologia';
export type ExtractionMode = 'auto' | 'directed' | 'mixed';

export interface ExtractionConfig {
  mode: ExtractionMode;
  focusTopics?: string;
  customEntityTypes?: string;
  customRelationTypes?: string;
  instructions?: string;
}
