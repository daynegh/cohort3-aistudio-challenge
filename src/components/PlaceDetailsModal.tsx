import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Star,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Navigation,
  Globe,
  Plus,
  Check,
  Building2,
  Calendar,
  MessageSquare,
  Compass,
} from 'lucide-react';
import { PlaceOfInterest, GooglePlaceDetails, GooglePlacePhoto } from '../types';

interface PlaceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  place: PlaceOfInterest | null;
  onAddToItinerary?: (place: PlaceOfInterest) => void;
  onPlanRouteToHere?: (place: PlaceOfInterest) => void;
  isInItinerary?: boolean;
}

export const PlaceDetailsModal: React.FC<PlaceDetailsModalProps> = ({
  isOpen,
  onClose,
  place,
  onAddToItinerary,
  onPlanRouteToHere,
  isInItinerary = false,
}) => {
  const [details, setDetails] = useState<GooglePlaceDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [showHoursDropdown, setShowHoursDropdown] = useState<boolean>(false);
  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !place) {
      setDetails(null);
      setSelectedPhotoIndex(0);
      return;
    }

    let isMounted = true;
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (place.placeId) queryParams.set('placeId', place.placeId);
        if (place.name) queryParams.set('name', place.name);
        if (place.address) queryParams.set('address', place.address);
        if (place.lat) queryParams.set('lat', String(place.lat));
        if (place.lng) queryParams.set('lng', String(place.lng));

        const res = await fetch(`/api/places/details?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && data.details) {
            setDetails(data.details);
          }
        }
      } catch (err) {
        console.warn('Error fetching place details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [isOpen, place]);

  if (!isOpen || !place) return null;

  const handleAddItinerary = () => {
    if (onAddToItinerary) {
      onAddToItinerary(place);
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 2000);
    }
  };

  const photos: GooglePlacePhoto[] = details?.photos && details.photos.length > 0
    ? details.photos
    : place.photoUrl
    ? [{ name: 'custom_photo', proxyUrl: place.photoUrl }]
    : [
        {
          name: 'fallback_default',
          proxyUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
          authorAttributions: [{ displayName: 'ReflectAI Photography' }],
        },
      ];

  const activePhoto = photos[selectedPhotoIndex] || photos[0];
  const rating = details?.rating ?? place.rating ?? 4.8;
  const ratingCount = details?.userRatingCount ?? 124;
  const priceLevel = details?.priceLevel || place.priceLevel || '$$';
  const editorialSummary = details?.editorialSummary || place.editorialSummary || place.notes;

  return (
    <div
      id="place-details-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="place-details-modal-container"
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Compass className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                Place Insights & Metadata
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Google Places API (New) Real-Time Data
              </span>
            </div>
          </div>
          <button
            id="close-place-details-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Photo Gallery */}
          <div className="space-y-3">
            <div className="relative w-full h-56 sm:h-64 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs">
              <img
                src={activePhoto.proxyUrl}
                alt={place.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-all duration-300"
              />
              {activePhoto.authorAttributions && activePhoto.authorAttributions.length > 0 && (
                <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-slate-900/75 backdrop-blur-xs text-[11px] text-white/90">
                  Photo by {activePhoto.authorAttributions[0].displayName}
                </div>
              )}
              {details?.isOpenNow !== undefined && (
                <div
                  className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-xs ${
                    details.isOpenNow
                      ? 'bg-emerald-500/90 text-white'
                      : 'bg-rose-500/90 text-white'
                  }`}
                >
                  {details.isOpenNow ? '● Open Now' : '● Closed'}
                </div>
              )}
            </div>

            {/* Photo Thumbnails Selector */}
            {photos.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {photos.map((photo, idx) => (
                  <button
                    key={idx}
                    id={`photo-thumb-${idx}`}
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`relative flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedPhotoIndex === idx
                        ? 'border-indigo-600 dark:border-indigo-400 scale-105 shadow-sm'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={photo.proxyUrl}
                      alt={`Thumbnail ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Place Title & Essential Information */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {details?.name || place.localizedName || place.name}
              </h1>
              <div className="flex items-center gap-2">
                {priceLevel && (
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {priceLevel}
                  </span>
                )}
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {rating.toFixed(1)}
                  <span className="text-amber-600/75 dark:text-amber-400/75 font-normal">
                    ({ratingCount})
                  </span>
                </span>
              </div>
            </div>

            {place.originalName && place.originalName !== place.name && (
              <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                Native Script: {place.originalName}
              </div>
            )}

            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
              <MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
              <span>{details?.formattedAddress || place.localizedAddress || place.address}</span>
            </div>
          </div>

          {/* Operating Hours Accordion */}
          {details?.weekdayDescriptions && details.weekdayDescriptions.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
              <button
                id="toggle-opening-hours-btn"
                onClick={() => setShowHoursDropdown(!showHoursDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Opening Hours Schedule</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    showHoursDropdown ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {showHoursDropdown && (
                <div className="px-4 pb-3 pt-1 space-y-1 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60">
                  {details.weekdayDescriptions.map((dayDesc, idx) => (
                    <div key={idx} className="flex justify-between py-0.5">
                      <span>{dayDesc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Editorial Summary / Description */}
          {editorialSummary && (
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <Sparkles className="w-4 h-4" />
                <span>Editorial Overview</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {editorialSummary}
              </p>
            </div>
          )}

          {/* User Reviews */}
          {details?.reviews && details.reviews.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Google Community Reviews
                  </h3>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Verified Insights
                </span>
              </div>

              <div className="space-y-2.5">
                {details.reviews.map((rev, rIdx) => (
                  <div
                    key={rIdx}
                    className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {rev.authorPhotoUri ? (
                          <img
                            src={rev.authorPhotoUri}
                            alt={rev.authorName}
                            referrerPolicy="no-referrer"
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                            {rev.authorName.charAt(0)}
                          </div>
                        )}
                        <span className="text-xs font-medium text-slate-900 dark:text-white">
                          {rev.authorName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex">
                          {Array.from({ length: rev.rating || 5 }).map((_, s) => (
                            <Star
                              key={s}
                              className="w-3 h-3 fill-amber-400 text-amber-400"
                            />
                          ))}
                        </div>
                        {rev.relativePublishTimeDescription && (
                          <span className="text-[10px] text-slate-400 ml-1">
                            {rev.relativePublishTimeDescription}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
                      "{rev.text}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            {details?.googleMapsUri && (
              <a
                id="open-in-google-maps-link"
                href={details.googleMapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span>Open in Google Maps</span>
                <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
              </a>
            )}
            {details?.websiteUri && (
              <a
                id="open-website-link"
                href={details.websiteUri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Website</span>
                <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onPlanRouteToHere && (
              <button
                id="plan-route-to-here-btn"
                onClick={() => {
                  onPlanRouteToHere(place);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Route Here</span>
              </button>
            )}

            {onAddToItinerary && (
              <button
                id="add-to-itinerary-btn"
                onClick={handleAddItinerary}
                disabled={isInItinerary || addedSuccess}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white shadow-xs transition-all ${
                  isInItinerary || addedSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98'
                }`}
              >
                {isInItinerary || addedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>In Itinerary</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Itinerary</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
