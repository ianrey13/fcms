// resources/js/components/TripForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { locationAPI } from '../../services/api';
import { debounce } from 'lodash';
import { MapPin, Loader2, Search, X } from 'lucide-react';

const TripForm = ({ onEstimateCalculated }) => {
    const [destination, setDestination] = useState('');
    const [origin, setOrigin] = useState('Laguindingan Municipal Hall');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [tripEstimate, setTripEstimate] = useState(null);
    const [vehicleId, setVehicleId] = useState('');

    // Debounced search function
    const searchPlaces = useCallback(
        debounce(async (query) => {
            if (query.length < 2) {
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            try {
                const response = await locationAPI.searchPlaces(query);
                console.log('🔍 Search results:', response.data);
                
                if (response.data.success && response.data.predictions) {
                    // ✅ Filter out region-level results (like "Northern Mindanao")
                    const filtered = response.data.predictions.filter(item => {
                        // Keep results that are cities, towns, or specific places
                        const description = item.description.toLowerCase();
                        return !description.includes('region') && 
                               !description.includes('province') &&
                               item.lat !== null && 
                               item.lng !== null;
                    });
                    
                    setSuggestions(filtered);
                    setShowSuggestions(filtered.length > 0);
                } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            } catch (error) {
                console.error('Search error:', error);
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300),
        []
    );

    const handleDestinationChange = (value) => {
        setDestination(value);
        searchPlaces(value);
        setSelectedLocation(null);
        setTripEstimate(null);
    };

    const handleSelectSuggestion = (suggestion) => {
        setDestination(suggestion.description);
        setSelectedLocation(suggestion);
        setShowSuggestions(false);
        calculateDistance(suggestion);
    };

    const calculateDistance = async (location) => {
        if (!location || !origin) return;

        setLoading(true);
        try {
            const response = await locationAPI.calculateDistance({
                origin: origin,
                destination: location.description,
                vehicle_id: vehicleId || undefined,
            });

            console.log('📏 Distance result:', response.data);

            if (response.data.success) {
                const data = response.data;
                setTripEstimate(data);
                
                // ✅ Pass the estimate to parent component
                if (onEstimateCalculated) {
                    onEstimateCalculated(data);
                }

                // ✅ Auto-fill form fields
                const distanceInput = document.querySelector('input[name="estimated_distance_km"]');
                const fuelInput = document.querySelector('input[name="estimated_fuel_liters"]');
                const costInput = document.querySelector('input[name="estimated_cost"]');
                
                if (distanceInput) distanceInput.value = data.distance_km;
                if (fuelInput) fuelInput.value = data.estimated_liters;
                if (costInput) costInput.value = data.estimated_cost;
            }
        } catch (error) {
            console.error('Distance calculation error:', error);
            // Show user-friendly error
            alert('Failed to calculate distance. Please try again or enter manually.');
        } finally {
            setLoading(false);
        }
    };

    const clearDestination = () => {
        setDestination('');
        setSelectedLocation(null);
        setTripEstimate(null);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && destination.length > 2) {
            // ✅ If user presses Enter, try to search directly
            const suggestion = suggestions[0];
            if (suggestion) {
                handleSelectSuggestion(suggestion);
            } else {
                // ✅ If no suggestion, try to geocode directly
                const fakeSuggestion = {
                    description: destination,
                    lat: null,
                    lng: null,
                };
                handleSelectSuggestion(fakeSuggestion);
            }
        }
    };

    return (
        <div className="space-y-4">
            {/* Destination Input with Autocomplete */}
            <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Destination <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        value={destination}
                        onChange={(e) => handleDestinationChange(e.target.value)}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type destination (e.g., Cagayan de Oro)"
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                    />
                    {destination && (
                        <button
                            onClick={clearDestination}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </button>
                    )}
                    {loading && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        </div>
                    )}
                </div>

                {/* Autocomplete Suggestions */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {suggestions.map((suggestion, index) => (
                            <div
                                key={index}
                                onClick={() => handleSelectSuggestion(suggestion)}
                                className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer flex items-start gap-2"
                            >
                                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                        {suggestion.description}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {suggestion.lat && suggestion.lng 
                                            ? `${suggestion.lat.toFixed(4)}, ${suggestion.lng.toFixed(4)}`
                                            : 'Click to calculate distance'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Trip Estimate Display */}
            {tripEstimate && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-blue-800 dark:text-blue-300">
                            📍 Trip Estimate
                        </h4>
                        <button
                            onClick={() => setTripEstimate(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Distance</p>
                            <p className="font-semibold text-blue-700 dark:text-blue-300 text-lg">
                                {tripEstimate.distance_km} km
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
                            <p className="font-semibold text-blue-700 dark:text-blue-300 text-lg">
                                {tripEstimate.duration_minutes} mins
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Estimated Fuel</p>
                            <p className="font-semibold text-blue-700 dark:text-blue-300 text-lg">
                                {tripEstimate.estimated_liters} L
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Estimated Cost</p>
                            <p className="font-semibold text-green-600 dark:text-green-400 text-lg">
                                ₱{tripEstimate.estimated_cost}
                            </p>
                        </div>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Based on {tripEstimate.fuel_efficiency_km_per_liter} km/L @ ₱{tripEstimate.fuel_price_per_liter}/L
                    </div>
                </div>
            )}

            {/* Hidden fields for form submission */}
            <input type="hidden" name="estimated_distance_km" value={tripEstimate?.distance_km || ''} />
            <input type="hidden" name="estimated_fuel_liters" value={tripEstimate?.estimated_liters || ''} />
            <input type="hidden" name="estimated_cost" value={tripEstimate?.estimated_cost || ''} />
            <input type="hidden" name="destination_lat" value={selectedLocation?.lat || ''} />
            <input type="hidden" name="destination_lng" value={selectedLocation?.lng || ''} />
            <input type="hidden" name="destination_place_id" value={selectedLocation?.place_id || ''} />
        </div>
    );
};

export default TripForm;