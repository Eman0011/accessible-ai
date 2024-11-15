import TopPipelineIcon from '../assets/aai_icons/pipeline_steps/TopPipeline.webp';
/**
 * Import Classifier Icons
 */
import BernoulliNBClassifierIcon from '../assets/aai_icons/classifiers/BernoulliNB.webp';
import DecisionTreeClassifierIcon from '../assets/aai_icons/classifiers/DecisionTreeClassifier.webp';
import ExtraTreesClassifierIcon from '../assets/aai_icons/classifiers/ExtraTreesClassifier.webp';
import GaussianNBClassifierIcon from '../assets/aai_icons/classifiers/GaussianNB.webp';
import GradientBoostingClassifierIcon from '../assets/aai_icons/classifiers/GradientBoostingClassifier.webp';
import KNeighborsClassifierIcon from '../assets/aai_icons/classifiers/KNeighborsClassifier.webp';
import LinearSVCClassifierIcon from '../assets/aai_icons/classifiers/LinearSVCClassifier.webp';
import LogisticRegressionIcon from '../assets/aai_icons/classifiers/LogisticRegression.webp';
import MLPClassifierIcon from '../assets/aai_icons/classifiers/MLPClassifier.webp';
import MultinomialNBClassifierIcon from '../assets/aai_icons/classifiers/MultinomialNB.webp';
import RandomForestClassifierIcon from '../assets/aai_icons/classifiers/RandomForestClassifier.webp';
import SGDClassifierIcon from '../assets/aai_icons/classifiers/SGDClassifier.webp';
import SVCClassifierIcon from '../assets/aai_icons/classifiers/SVCClassifier.webp';
import XGBClassifierIcon from '../assets/aai_icons/classifiers/XGBClassifier.webp';

/**
 * Import Pipeline Step Icons
 */
import BinarizerIcon from '../assets/aai_icons/pipeline_steps/Binarizer.webp';
import FeatureAgglomerationIcon from '../assets/aai_icons/pipeline_steps/FeatureAgglomeration.webp';
import KernelPCAIcon from '../assets/aai_icons/pipeline_steps/KernelPCA.webp';
import MaxAbsScalerIcon from '../assets/aai_icons/pipeline_steps/MaxAbsScaler.webp';
import MinMaxScalerIcon from '../assets/aai_icons/pipeline_steps/MinMaxScaler.webp';
import OneHotEncoderIcon from '../assets/aai_icons/pipeline_steps/OneHotEncoder.webp';
import PCAIcon from '../assets/aai_icons/pipeline_steps/PCA.webp';
import RobustScalerIcon from '../assets/aai_icons/pipeline_steps/RobustScaler.png';
import StandardScalerIcon from '../assets/aai_icons/pipeline_steps/StandardScaler.webp';
import ZeroCountEncoderIcon from '../assets/aai_icons/pipeline_steps/ZeroCountEncoder.webp';
import NormalizerIcon from '../assets/aai_icons/pipeline_steps/Normalizer.webp';
import PolynomialFeaturesIcon from '../assets/aai_icons/pipeline_steps/PolynomialFeatures.webp';


// Icon mapping
const PIPELINE_STEP_ICONS: { [key: string]: string } = {
    /**
     * Classifier Icons
     */
    'ExtraTreesClassifier': ExtraTreesClassifierIcon,
    'RandomForestClassifier': RandomForestClassifierIcon,
    'GradientBoostingClassifier': GradientBoostingClassifierIcon,
    'LogisticRegression': LogisticRegressionIcon,
    'SVC': SVCClassifierIcon,
    'LinearSVC': LinearSVCClassifierIcon,
    'KNeighborsClassifier': KNeighborsClassifierIcon,
    'DecisionTreeClassifier': DecisionTreeClassifierIcon,
    'SGDClassifier': SGDClassifierIcon,
    'MLPClassifier': MLPClassifierIcon,
    'GaussianNB': GaussianNBClassifierIcon,
    'XGBClassifier': XGBClassifierIcon,
    'BernoulliNB': BernoulliNBClassifierIcon,
    'MultinomialNB': MultinomialNBClassifierIcon,
    /**
     * Pipeline Step Icons
     */
    'OneHotEncoder': OneHotEncoderIcon,
    'TopPipeline': TopPipelineIcon,
    'MinMaxScaler': MinMaxScalerIcon,
    'StandardScaler': StandardScalerIcon,
    'MaxAbsScaler': MaxAbsScalerIcon,
    'RobustScaler': RobustScalerIcon,
    'ZeroCount': ZeroCountEncoderIcon,
    'Binarizer': BinarizerIcon,
    'KernelPCA': KernelPCAIcon,
    'PCA': PCAIcon,
    'FeatureAgglomeration': FeatureAgglomerationIcon,
    'Normalizer': NormalizerIcon,
    'PolynomialFeatures': PolynomialFeaturesIcon,
};

// Default icon if no match is found - using Cloudscape's icon name
const DEFAULT_ICON = 'settings';

// Top pipeline icon name from Cloudscape icons
export const TOP_PIPELINE_ICON = 'status-positive';

/**
 * Returns the appropriate icon for a pipeline step
 * @param step The pipeline step object
 * @returns The icon path or default icon name
 */
export function getPipelineStepIcon(step: { class_name: string }): string {
  return PIPELINE_STEP_ICONS[step.class_name] || DEFAULT_ICON;
}

/**
 * Checks if the step has a custom icon
 * @param step The pipeline step object
 * @returns boolean indicating if a custom icon exists
 */
export function hasCustomIcon(step: { class_name: string }): boolean {
  return step.class_name in PIPELINE_STEP_ICONS;
} 