/*---------------------------------------
File: src/utils/feature-access.ts
Description: Type-safe helper class for accessing subscription plan features and limits
Author: Kyle Lovesy
Date: 09/11-2025
Version: 2.0.0
---------------------------------------*/
import { SubscriptionPlanData } from '@/domain/subscription/plan.schema';

/**
 * A type-safe helper to access subscription limits and features.
 * This class encapsulates all nested data structures and provides
 * clean, flat access patterns without magic strings.
 *
 * @example
 * ```typescript
 * const planData = subscriptionService.getPlanData(user.subscription.plan);
 * if (!planData) return <LoadingSpinner />;
 *
 * const features = new FeatureAccess(planData);
 *
 * // Boolean checks
 * if (features.canUseClientPortal()) { ... }
 * if (features.canUseCustomBranding()) { ... }
 *
 * // Limit checks
 * const maxProjects = features.getProjectLimit();
 * if (!features.isProjectLimitReached(currentCount)) {
 *   // Allow user to create a new project
 * }
 * ```
 */
export class FeatureAccess {
  private plan: SubscriptionPlanData;

  constructor(planData: SubscriptionPlanData) {
    this.plan = planData;
  }

  // ============================================================================
  // CLIENT PORTAL FEATURES
  // ============================================================================

  /**
   * Check if client portal is enabled
   */
  public canUseClientPortal(): boolean {
    return this.plan.clientPortal.enabled;
  }

  /**
   * Check if custom branding is available
   */
  public canUseCustomBranding(): boolean {
    return this.plan.clientPortal.customBranding;
  }

  /**
   * Check if custom welcome message is available
   */
  public canUseCustomWelcomeMessage(): boolean {
    return this.plan.clientPortal.customWelcomeMessage;
  }

  /**
   * Check if custom thank you message is available
   */
  public canUseCustomThankYou(): boolean {
    return this.plan.clientPortal.customThankYou;
  }

  /**
   * Check if real-time sync is available
   */
  public canUseRealTimeSync(): boolean {
    return this.plan.clientPortal.realTimeSync;
  }

  /**
   * Get client portal access duration in days
   */
  public getClientPortalAccessDuration(): number {
    return this.plan.clientPortal.accessDuration;
  }

  /**
   * Check if access extension is available
   */
  public canExtendAccess(): boolean {
    return this.plan.clientPortal.extendAccess;
  }

  // ============================================================================
  // PORTAL FEATURES
  // ============================================================================

  /**
   * Check if client can add locations in portal
   */
  public canClientAddLocations(): boolean {
    return this.plan.portalLocation.clientCanAdd;
  }

  /**
   * Check if multiple locations are supported
   */
  public canUseMultipleLocations(): boolean {
    return this.plan.portalLocation.multipleLocations;
  }

  /**
   * Check if client can add timeline events
   */
  public canClientAddTimelineEvents(): boolean {
    return this.plan.portalTimeline.clientCanAdd;
  }

  /**
   * Get maximum timeline events in portal
   */
  public getPortalTimelineMaxEvents(): number {
    return this.plan.portalTimeline.maxEvents;
  }

  /**
   * Check if client can select group shots
   */
  public canClientSelectGroupShots(): boolean {
    return this.plan.portalGroupShots.clientCanSelect;
  }

  /**
   * Check if time estimate is shown for group shots
   */
  public canShowGroupShotTimeEstimate(): boolean {
    return this.plan.portalGroupShots.showTimeEstimate;
  }

  /**
   * Check if client can select couple shots
   */
  public canClientSelectCoupleShots(): boolean {
    return this.plan.portalCoupleShots.clientCanSelect;
  }

  /**
   * Check if time estimate is shown for couple shots
   */
  public canShowCoupleShotTimeEstimate(): boolean {
    return this.plan.portalCoupleShots.showTimeEstimate;
  }

  /**
   * Check if custom gallery is available for couple shots
   */
  public canUseCustomGallery(): boolean {
    return this.plan.portalCoupleShots.customGallery;
  }

  /**
   * Check if client can add key people
   */
  public canClientAddKeyPeople(): boolean {
    return this.plan.portalKeyPeople.clientCanAdd;
  }

  /**
   * Get maximum key people count in portal
   */
  public getPortalKeyPeopleMaxCount(): number {
    return this.plan.portalKeyPeople.maxCount;
  }

  /**
   * Check if client can add avatars for key people
   */
  public canClientAddAvatars(): boolean {
    return this.plan.portalKeyPeople.canAddAvatar;
  }

  /**
   * Check if client can request photos
   */
  public canClientRequestPhotos(): boolean {
    return this.plan.portalPhotoRequests.clientCanRequest;
  }

  /**
   * Get maximum photo requests per project
   */
  public getPortalPhotoRequestsMaxRequests(): number {
    return this.plan.portalPhotoRequests.maxRequests;
  }

  /**
   * Check if photo requests can include images
   */
  public canRequestPhotosWithImage(): boolean {
    return this.plan.portalPhotoRequests.requestWithImage;
  }

  // ============================================================================
  // PROJECT FEATURES
  // ============================================================================

  /**
   * Check if projects feature is enabled
   */
  public canUseProjects(): boolean {
    return this.plan.projects.enabled;
  }

  /**
   * Get maximum number of projects
   */
  public getProjectLimit(): number {
    return this.plan.projects.maxCount;
  }

  /**
   * Check if custom project images are available
   */
  public canUseCustomProjectImage(): boolean {
    return this.plan.projects.customImage;
  }

  /**
   * Check if project limit is reached
   */
  public isProjectLimitReached(currentCount: number): boolean {
    if (!this.plan.projects.enabled) return true;
    return currentCount >= this.plan.projects.maxCount;
  }

  // ============================================================================
  // LIST FEATURES
  // ============================================================================

  /**
   * Check if kit list is enabled
   */
  public canUseKitList(): boolean {
    return this.plan.kitList.enabled;
  }

  /**
   * Check if kit list is user customizable
   */
  public canCustomizeKitListUser(): boolean {
    return this.plan.kitList.userCustomizable;
  }

  /**
   * Check if kit list is project customizable
   */
  public canCustomizeKitListProject(): boolean {
    return this.plan.kitList.projectCustomizable;
  }

  /**
   * Get maximum kit list additions
   */
  public getKitListMaxAdditions(): number {
    return this.plan.kitList.maxAdditions;
  }

  /**
   * Check if task list is enabled
   */
  public canUseTaskList(): boolean {
    return this.plan.taskList.enabled;
  }

  /**
   * Check if task list is user customizable
   */
  public canCustomizeTaskListUser(): boolean {
    return this.plan.taskList.userCustomizable;
  }
  /**
   * Check if task reminders are available
   */
  public canUseTaskReminders(): boolean {
    return this.plan.taskList.taskReminders;
  }

  /**
   * Get maximum task list additions
   */
  public getTaskListMaxAdditions(): number {
    return this.plan.taskList.maxAdditions;
  }

  /**
   * Check if group shot list is enabled
   */
  public canUseGroupShotList(): boolean {
    return this.plan.groupShotList.enabled;
  }

  /**
   * Check if group shot list is user customizable
   */
  public canCustomizeGroupShotListUser(): boolean {
    return this.plan.groupShotList.userCustomizable;
  }
  /**
   * Check if custom timings are available for group shots
   */
  public canUseCustomGroupShotTimings(): boolean {
    return this.plan.groupShotList.customTimings;
  }

  /**
   * Check if real-time sync to portal is available for group shots
   */
  public canUseGroupShotRealTimeSync(): boolean {
    return this.plan.groupShotList.realTimeSyncToPortal;
  }

  /**
   * Get maximum group shot list additions
   */
  public getGroupShotListMaxAdditions(): number {
    return this.plan.groupShotList.maxAdditions;
  }

  /**
   * Check if couple shot list is enabled
   */
  public canUseCoupleShotList(): boolean {
    return this.plan.coupleShotList.enabled;
  }

  /**
   * Check if couple shot list is user customizable
   */
  public canCustomizeCoupleShotListUser(): boolean {
    return this.plan.coupleShotList.userCustomizable;
  }
  /**
   * Check if custom timings are available for couple shots
   */
  public canUseCustomCoupleShotTimings(): boolean {
    return this.plan.coupleShotList.customTimings;
  }

  /**
   * Check if couple shots can sync to portal
   */
  public canSyncCoupleShotsToPortal(): boolean {
    return this.plan.coupleShotList.syncToPortal;
  }

  /**
   * Check if couple shot gallery is available
   */
  public canUseCoupleShotGallery(): boolean {
    return this.plan.coupleShotList.gallery;
  }

  /**
   * Get maximum couple shot gallery count
   */
  public getCoupleShotGalleryMaxCount(): number {
    return this.plan.coupleShotList.maxGalleryCount;
  }

  /**
   * Get maximum couple shot list additions
   */
  public getCoupleShotListMaxAdditions(): number {
    return this.plan.coupleShotList.maxAdditions;
  }

  // ============================================================================
  // BUSINESS CARD FEATURES
  // ============================================================================

  /**
   * Check if business card is enabled
   */
  public canUseBusinessCard(): boolean {
    return this.plan.businessCard.enabled;
  }

  /**
   * Check if quick share is available
   */
  public canUseQuickShare(): boolean {
    return this.plan.businessCard.quickShare;
  }

  /**
   * Check if QR card is available
   */
  public canUseQRCard(): boolean {
    return this.plan.businessCard.qrCard;
  }

  /**
   * Check if NFC is enabled
   */
  public canUseNFC(): boolean {
    return this.plan.businessCard.nfcEnabled;
  }

  // ============================================================================
  // KEY PEOPLE FEATURES
  // ============================================================================

  /**
   * Check if key people feature is enabled
   */
  public canUseKeyPeople(): boolean {
    return this.plan.keyPeople.enabled;
  }

  /**
   * Check if key people can be added
   */
  public canAddKeyPeople(): boolean {
    return this.plan.keyPeople.canAdd;
  }

  /**
   * Check if avatars can be added for key people
   */
  public canAddKeyPeopleAvatars(): boolean {
    return this.plan.keyPeople.canAddAvatar;
  }

  /**
   * Get maximum key people per project
   */
  public getKeyPeopleLimit(): number {
    return this.plan.keyPeople.maxPerProject;
  }

  /**
   * Check if roles and tags are available for key people
   */
  public canUseKeyPeopleRolesAndTags(): boolean {
    return this.plan.keyPeople.rolesAndTags;
  }

  /**
   * Check if key people can sync to portal
   */
  public canSyncKeyPeopleToPortal(): boolean {
    return this.plan.keyPeople.portalSync;
  }

  /**
   * Check if key people limit is reached
   */
  public isKeyPeopleLimitReached(currentCount: number): boolean {
    if (!this.plan.keyPeople.enabled || !this.plan.keyPeople.canAdd) return true;
    return currentCount >= this.plan.keyPeople.maxPerProject;
  }

  // ============================================================================
  // LOCATIONS FEATURES
  // ============================================================================

  /**
   * Check if locations feature is enabled
   */
  public canUseLocations(): boolean {
    return this.plan.locations.enabled;
  }

  /**
   * Check if locations can be added
   */
  public canAddLocations(): boolean {
    return this.plan.locations.canAdd;
  }

  /**
   * Get maximum locations per project
   */
  public getLocationsLimit(): number {
    return this.plan.locations.maxPerProject;
  }

  /**
   * Check if quick add is available for locations
   */
  public canUseQuickAddLocations(): boolean {
    return this.plan.locations.quickAdd;
  }

  /**
   * Check if quick directions are available
   */
  public canUseQuickDirections(): boolean {
    return this.plan.locations.quickDirections;
  }

  /**
   * Check if multiple locations are supported
   */
  public canUseMultipleLocationsInProject(): boolean {
    return this.plan.locations.multipleLocations;
  }

  /**
   * Check if locations can sync to portal
   */
  public canSyncLocationsToPortal(): boolean {
    return this.plan.locations.portalSync;
  }

  /**
   * Check if timeline event linking is available
   */
  public canLinkLocationsToTimelineEvents(): boolean {
    return this.plan.locations.timelineEventLink;
  }

  /**
   * Check if locations limit is reached
   */
  public isLocationsLimitReached(currentCount: number): boolean {
    if (!this.plan.locations.enabled || !this.plan.locations.canAdd) return true;
    return currentCount >= this.plan.locations.maxPerProject;
  }

  // ============================================================================
  // NOTES FEATURES
  // ============================================================================

  /**
   * Check if notes feature is enabled
   */
  public canUseNotes(): boolean {
    return this.plan.notes.enabled;
  }

  /**
   * Check if notes can be added
   */
  public canAddNotes(): boolean {
    return this.plan.notes.canAdd;
  }

  /**
   * Get maximum notes per project
   */
  public getNotesLimit(): number {
    return this.plan.notes.maxPerProject;
  }

  /**
   * Get maximum note categories
   */
  public getNotesCategoryCount(): number {
    return this.plan.notes.categoryCount;
  }

  /**
   * Check if global save is available for notes
   */
  public canUseGlobalNotes(): boolean {
    return this.plan.notes.globalSave;
  }

  /**
   * Get maximum global notes
   */
  public getGlobalNotesLimit(): number {
    return this.plan.notes.maxGlobalNotes;
  }

  /**
   * Check if private notes are available
   */
  public canUsePrivateNotes(): boolean {
    return this.plan.notes.privateNotes;
  }

  /**
   * Check if notes limit is reached
   */
  public isNoteLimitReached(currentCount: number): boolean {
    if (!this.plan.notes.enabled || !this.plan.notes.canAdd) return true;
    return currentCount >= this.plan.notes.maxPerProject;
  }

  // ============================================================================
  // TIMELINE FEATURES
  // ============================================================================

  /**
   * Check if timeline feature is enabled
   */
  public canUseTimeline(): boolean {
    return this.plan.timeline.enabled;
  }

  /**
   * Check if timeline preview is available
   */
  public canUseTimelinePreview(): boolean {
    return this.plan.timeline.preview;
  }

  /**
   * Get maximum timeline events
   */
  public getTimelineMaxEvents(): number {
    return this.plan.timeline.maxEvents;
  }

  /**
   * Check if manual timeline event addition is available
   */
  public canManuallyAddTimelineEvents(): boolean {
    return this.plan.timeline.manualAdd;
  }

  /**
   * Check if timeline can sync to portal
   */
  public canSyncTimelineToPortal(): boolean {
    return this.plan.timeline.portalSync;
  }

  /**
   * Check if dynamic timeline is available
   */
  public canUseDynamicTimeline(): boolean {
    return this.plan.timeline.dynamic;
  }

  /**
   * Check if interactive timeline is available
   */
  public canUseInteractiveTimeline(): boolean {
    return this.plan.timeline.interactive;
  }

  // ============================================================================
  // GOLDEN HOUR FEATURES
  // ============================================================================

  /**
   * Check if golden hour feature is enabled
   */
  public canUseGoldenHour(): boolean {
    return this.plan.goldenHour.enabled;
  }

  /**
   * Check if real-time sync is available for golden hour
   */
  public canUseGoldenHourRealTimeSync(): boolean {
    return this.plan.goldenHour.realTimeSync;
  }

  /**
   * Check if golden hour alerts are available
   */
  public canUseGoldenHourAlerts(): boolean {
    return this.plan.goldenHour.alert;
  }

  /**
   * Check if time-location sync is available for golden hour
   */
  public canUseGoldenHourTimeLocationSync(): boolean {
    return this.plan.goldenHour.timeLocationSync;
  }

  /**
   * Check if golden hour suggestions are available
   */
  public canUseGoldenHourSuggestions(): boolean {
    return this.plan.goldenHour.suggestions;
  }

  // ============================================================================
  // WEATHER FEATURES
  // ============================================================================

  /**
   * Check if weather feature is enabled
   */
  public canUseWeather(): boolean {
    return this.plan.weather.enabled;
  }

  /**
   * Check if real-time sync is available for weather
   */
  public canUseWeatherRealTimeSync(): boolean {
    return this.plan.weather.realTimeSync;
  }

  /**
   * Check if optimal time card is available
   */
  public canUseOptimalTimeCard(): boolean {
    return this.plan.weather.optimalTimeCard;
  }

  /**
   * Check if weather action card is available
   */
  public canUseWeatherActionCard(): boolean {
    return this.plan.weather.weatherActionCard;
  }

  /**
   * Check if on-the-day card is available
   */
  public canUseOnTheDayCard(): boolean {
    return this.plan.weather.onTheDayCard;
  }

  /**
   * Check if packing forecast is available
   */
  public canUsePackingForecast(): boolean {
    return this.plan.weather.packingForecast;
  }

  /**
   * Check if planning forecast is available
   */
  public canUsePlanningForecast(): boolean {
    return this.plan.weather.planningForecast;
  }

  // ============================================================================
  // NOTIFICATIONS FEATURES
  // ============================================================================

  /**
   * Check if notifications feature is enabled
   */
  public canUseNotifications(): boolean {
    return this.plan.notifications.enabled;
  }

  /**
   * Check if general notifications are available
   */
  public canUseGeneralNotifications(): boolean {
    return this.plan.notifications.general;
  }

  /**
   * Check if task notifications are available
   */
  public canUseTaskNotifications(): boolean {
    return this.plan.notifications.tasks;
  }

  /**
   * Check if timeline notifications are available
   */
  public canUseTimelineNotifications(): boolean {
    return this.plan.notifications.timeline;
  }

  /**
   * Check if weather alert notifications are available
   */
  public canUseWeatherAlertNotifications(): boolean {
    return this.plan.notifications.weatherAlerts;
  }

  // ============================================================================
  // TIPS & GUIDES FEATURES
  // ============================================================================

  /**
   * Check if rule of thirds guide is available
   */
  public canUseRuleOfThirds(): boolean {
    return this.plan.tipsAndGuides.ruleOfThirds;
  }

  /**
   * Check if sunny 16 guide is available
   */
  public canUseSunny16(): boolean {
    return this.plan.tipsAndGuides.sunny16;
  }

  /**
   * Check if couple poses guide is available
   */
  public canUseCouplePoses(): boolean {
    return this.plan.tipsAndGuides.couplePoses;
  }

  /**
   * Check if perfect exposure guide is available
   */
  public canUsePerfectExposure(): boolean {
    return this.plan.tipsAndGuides.perfectExposure;
  }

  /**
   * Check if motion blur guide is available
   */
  public canUseMotionBlur(): boolean {
    return this.plan.tipsAndGuides.motionBlur;
  }

  /**
   * Check if golden hour guide is available
   */
  public canUseGoldenHourGuide(): boolean {
    return this.plan.tipsAndGuides.goldenHour;
  }

  // ============================================================================
  // IMAGE TAG & SHARE FEATURES
  // ============================================================================

  /**
   * Check if image tag & share feature is enabled
   */
  public canUseImageTagShare(): boolean {
    return this.plan.imageTagShare.enabled;
  }

  /**
   * Check if tag management is available
   */
  public canUseTagManagement(): boolean {
    return this.plan.imageTagShare.tagManagement;
  }

  /**
   * Check if global tags are available
   */
  public canUseGlobalTags(): boolean {
    return this.plan.imageTagShare.globalTags;
  }

  /**
   * Get maximum tag categories
   */
  public getTagCategoryCount(): number {
    return this.plan.imageTagShare.categoryCount;
  }

  /**
   * Get maximum tags
   */
  public getTagLimit(): number {
    return this.plan.imageTagShare.maxTags;
  }

  /**
   * Check if photo sharing is available
   */
  public canSharePhotos(): boolean {
    return this.plan.imageTagShare.canShare;
  }

  /**
   * Get maximum images that can be shared
   */
  public getMaxShareableImages(): number {
    return this.plan.imageTagShare.maxImages;
  }

  /**
   * Check if quick share is available
   */
  public canUseQuickSharePhotos(): boolean {
    return this.plan.imageTagShare.quickShare;
  }

  // ============================================================================
  // VENDORS FEATURES
  // ============================================================================

  /**
   * Check if vendors feature is enabled
   */
  public canUseVendors(): boolean {
    return this.plan.vendors.enabled;
  }

  /**
   * Check if vendor management is available
   */
  public canUseVendorManagement(): boolean {
    return this.plan.vendors.vendorManagement;
  }

  /**
   * Get maximum vendors per project
   */
  public getVendorsLimit(): number {
    return this.plan.vendors.maxPerProject;
  }

  /**
   * Get maximum vendor categories
   */
  public getVendorCategoryCount(): number {
    return this.plan.vendors.categoryCount;
  }

  /**
   * Check if global vendor save is available
   */
  public canUseGlobalVendors(): boolean {
    return this.plan.vendors.globalSave;
  }

  /**
   * Get maximum global vendors
   */
  public getGlobalVendorsLimit(): number {
    return this.plan.vendors.maxGlobalVendors;
  }

  /**
   * Check if manual vendor addition is available
   */
  public canManuallyAddVendors(): boolean {
    return this.plan.vendors.manualAdd;
  }

  /**
   * Check if QR scan is available for vendors
   */
  public canUseQRScanForVendors(): boolean {
    return this.plan.vendors.addByQRScan;
  }

  /**
   * Check if NFC is available for vendors
   */
  public canUseNFCForVendors(): boolean {
    return this.plan.vendors.addByNFC;
  }

  /**
   * Check if vendors limit is reached
   */
  public isVendorsLimitReached(currentCount: number): boolean {
    if (!this.plan.vendors.enabled) return true;
    return currentCount >= this.plan.vendors.maxPerProject;
  }

  // ============================================================================
  // PHOTO REQUESTS FEATURES
  // ============================================================================

  /**
   * Check if photo requests feature is enabled
   */
  public canUsePhotoRequests(): boolean {
    return this.plan.photoRequests.enabled;
  }

  /**
   * Check if photo requests can sync to portal
   */
  public canSyncPhotoRequestsToPortal(): boolean {
    return this.plan.photoRequests.portalSync;
  }

  /**
   * Get maximum photo requests per project
   */
  public getPhotoRequestsLimit(): number {
    return this.plan.photoRequests.maxPerProject;
  }

  /**
   * Check if images can be added to photo requests
   */
  public canAddImagesToPhotoRequests(): boolean {
    return this.plan.photoRequests.canAddImage;
  }

  /**
   * Get maximum global images for photo requests
   */
  public getPhotoRequestsGlobalImagesLimit(): number {
    return this.plan.photoRequests.maxGlobalImages;
  }

  // ============================================================================
  // IMPORT/EXPORT FEATURES
  // ============================================================================

  /**
   * Check if CSV import is available
   */
  public canImportCSV(): boolean {
    return this.plan.importExport.importCSV;
  }

  /**
   * Check if Excel import is available
   */
  public canImportExcel(): boolean {
    return this.plan.importExport.importExcel;
  }

  /**
   * Check if JSON import is available
   */
  public canImportJSON(): boolean {
    return this.plan.importExport.importJSON;
  }

  /**
   * Check if timeline PDF export is available
   */
  public canExportTimelinePDF(): boolean {
    return this.plan.importExport.exportTimelinePDF;
  }

  /**
   * Check if group shots PDF export is available
   */
  public canExportGroupShotsPDF(): boolean {
    return this.plan.importExport.exportGroupShotsPDF;
  }

  /**
   * Check if couple shots PDF export is available
   */
  public canExportCoupleShotsPDF(): boolean {
    return this.plan.importExport.exportCoupleShotsPDF;
  }

  /**
   * Check if photo requests PDF export is available
   */
  public canExportPhotoRequestsPDF(): boolean {
    return this.plan.importExport.exportPhotoRequestsPDF;
  }

  /**
   * Check if locations PDF export is available
   */
  public canExportLocationsPDF(): boolean {
    return this.plan.importExport.exportLocationsPDF;
  }

  /**
   * Check if key people PDF export is available
   */
  public canExportKeyPeoplePDF(): boolean {
    return this.plan.importExport.exportKeyPeoplePDF;
  }

  // ============================================================================
  // SYSTEM FEATURES
  // ============================================================================

  /**
   * Check if offline sync is available
   */
  public canUseOfflineSync(): boolean {
    return this.plan.offlineSync;
  }

  /**
   * Get post-trial behavior ('read-only' or 'full-access')
   */
  public getPostTrialBehavior(): 'read-only' | 'full-access' {
    return this.plan.postTrialBehavior;
  }
}
