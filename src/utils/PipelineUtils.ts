import { IconProps } from '@cloudscape-design/components/icon';
type IconName = IconProps['name'];

export interface PipelineStepIcon {
  step_name: string;
  class_name: string;
  module: string;
  params: Record<string, any>;
}

export class PipelineIconUtils {
  /**
   * Gets the appropriate icon name for a pipeline step
   */
  public static getStepIcon(step: PipelineStepIcon): string {
    // Convert CamelCase to snake_case and add .webp extension
    return step.class_name
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .substring(1) + '.webp';
  }

  /**
   * Gets the arrow icon for connecting pipeline steps
   */
  public static getArrowIcon(): IconName {
    return 'angle-right';
  }
} 