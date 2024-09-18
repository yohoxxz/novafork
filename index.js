function handleError(message, error, showAlert = false) {
    console.error(message, error);
    if (showAlert) {
        alert(message);
    }
}

async function getApiKey() {
    try {
        const response = await fetch('apis/config.json');
        if (!response.ok) {
            throw new Error('Failed to load API key config.');
        }
        const config = await response.json();
        return config.apiKey;
    } catch (error) {
        handleError('Failed to fetch API key.', error);
        return null;
    }
}
async function fetchGenres(apiKey, mediaType) {
    try {
        const endpoint = mediaType === 'tv' ? 'genre/tv/list' : 'genre/movie/list';
        const response = await fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&language=en-US`);
        if (!response.ok) {
            throw new Error('Failed to fetch genres.');
        }
        const data = await response.json();
        return data.genres;
    } catch (error) {
        handleError('An error occurred while fetching genres:', error);
        return [];
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    const homePage = document.getElementById('homePage');
    const welcomeBanner = document.getElementById('welcomeBanner');
    const closeBanner = document.getElementById('closeBanner');
    const categorySelect = document.getElementById('categorySelect');
    const typeSelect = document.getElementById('typeSelect');
    const popularMedia = document.getElementById('popularMedia');
    const videoPlayerContainer = document.getElementById('videoPlayerContainer');
    const videoPlayer = document.getElementById('videoPlayer');
    const posterImage = document.getElementById('posterImage');
    const searchInput = document.getElementById('searchInput');
    const actorSearchInput = document.getElementById('actorSearchInput');
    const searchSuggestions = document.getElementById('searchSuggestions');
    const randomButton = document.getElementById('randomButton');


    let currentMediaType = 'popular';
    let currentPage = 1;
    let totalPages = 1;
    let currentActorId = null;

    if (closeBanner) {
        closeBanner.addEventListener('click', () => {
            welcomeBanner.style.display = 'none';
        });
    }

    if (homePage) {
        homePage.classList.remove('hidden');
    }

    const API_KEY = await getApiKey();
    if (!API_KEY) return;

    let genreMap = {};
    async function updateGenres(mediaType) {
        const genres = await fetchGenres(API_KEY, mediaType);
        genreMap = genres.reduce((map, genre) => {
            map[genre.id] = genre.name;
            return map;
        }, {});

        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Select Genre</option>';
            Object.entries(genreMap).forEach(([id, name]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                categorySelect.appendChild(option);
            });
        }
    }

    await updateGenres('movie');

    if (typeSelect) {
        typeSelect.innerHTML = `
      <option value="movie">Movies</option>
      <option value="tv">TV Shows</option>
    `;

        typeSelect.addEventListener('change', async (event) => {
            const selectedType = event.target.value;
            await updateGenres(selectedType);
            currentPage = 1; // Reset to first page
            await fetchPopularMedia(currentPage);
        });
    }

    // Event listener for actorSearchInput
    if (actorSearchInput) {
        actorSearchInput.addEventListener(
            'input',
            debounce(async function () {
                const actorName = actorSearchInput.value.trim();
                if (actorName.length > 2) {
                    const response = await fetch(
                        `https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&query=${encodeURIComponent(
                            actorName
                        )}`
                    );
                    if (response.ok) {
                        const data = await response.json();
                        if (data.results.length > 0) {
                            const actorId = data.results[0].id; // First actor result
                            currentActorId = actorId;
                            currentMediaType = 'actor';
                            currentPage = 1;
                            await fetchMoviesAndShowsByActor(actorId, currentPage);
                        } else {
                            handleError('No actor found with that name.');
                            clearMediaDisplay();
                            totalPages = 1;
                            updatePaginationControls(currentPage, totalPages);
                        }
                    } else {
                        handleError('Failed to fetch actor search results.');
                    }
                } else {
                    // Input is too short; reset to popular media
                    currentMediaType = 'popular';
                    currentPage = 1;
                    await fetchPopularMedia(currentPage);
                }
            }, 500) // Debounce delay of 500ms
        );
    }

    // Pagination Controls
    const prevPageButton = document.getElementById('prevPage');
    const nextPageButton = document.getElementById('nextPage');

    if (prevPageButton && nextPageButton) {
        prevPageButton.addEventListener('click', async function () {
            if (currentPage > 1) {
                currentPage--;
                await updateMediaDisplay();
            }
        });

        nextPageButton.addEventListener('click', async function () {
            if (currentPage < totalPages) {
                currentPage++;
                await updateMediaDisplay();
            }
        });
    }

    if (searchInput) {
        document
            .getElementById('searchButton')
            .addEventListener('click', () => search());
        searchInput.addEventListener('keydown', async function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                await search();
            }
        });

        searchInput.addEventListener(
            'input',
            debounce(async function () {
                const query = searchInput.value.trim();
                if (query.length > 2) {
                    const selectedCategory = categorySelect.value;
                    const selectedType = typeSelect.value;
                    const response = await fetch(
                        `https://api.themoviedb.org/3/search/${selectedType}?api_key=${API_KEY}&query=${encodeURIComponent(
                            query
                        )}&with_genres=${selectedCategory}`
                    );
                    if (response.ok) {
                        const data = await response.json();
                        displaySearchSuggestions(data.results);
                    } else {
                        searchSuggestions.classList.add('hidden');
                    }
                } else {
                    searchSuggestions.classList.add('hidden');
                }
            }, 500) // Debounce delay of 500ms
        );
    }


    if (categorySelect) {
        categorySelect.addEventListener('change', async () => {
            currentPage = 1;
            await fetchPopularMedia(currentPage);
        });
    }

    if (typeSelect) {
        typeSelect.addEventListener('change', async () => {
            currentPage = 1;
            await fetchPopularMedia(currentPage);
        });
    }


    async function fetchPopularMedia(page = 1) {
        currentMediaType = 'popular';
        currentPage = page;
        const selectedCategory = categorySelect.value;
        const selectedType = typeSelect.value;
        let url = '';
        let queryParams = `?api_key=${API_KEY}&page=${page}&language=en-US`;

        try {
            if (selectedCategory) {
                url = `https://api.themoviedb.org/3/discover/${selectedType}${queryParams}&with_genres=${selectedCategory}`;
            } else if (selectedType === 'tv') {
                url = `https://api.themoviedb.org/3/trending/tv/week${queryParams}`;
            } else {
                url = `https://api.themoviedb.org/3/trending/movie/week${queryParams}`;
            }

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();

                if (data.total_results === 0) {
                    clearMediaDisplay();
                    handleError('No media found.');
                    totalPages = 1;
                    updatePaginationControls(currentPage, totalPages);
                    return;
                }

                const results = data.results.slice(0, 12); // Limit to 12 items
                totalPages = data.total_pages; // Use data.total_pages directly
                displayPopularMedia(results);
                updatePaginationControls(currentPage, totalPages);
            } else {
                handleError(`Failed to fetch ${selectedType} media.`);
            }
        } catch (error) {
            handleError(
                `An error occurred while fetching ${selectedType} media.`,
                error
            );
        }
    }

    async function fetchMoviesAndShowsByActor(actorId, page = 1) {
        currentMediaType = 'actor';
        currentPage = page;
        const selectedType = typeSelect.value;
        const url = `https://api.themoviedb.org/3/discover/${selectedType}?api_key=${API_KEY}&with_cast=${actorId}&language=en-US&page=${page}`;

        try {
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();

                if (data.total_results === 0) {
                    clearMediaDisplay();
                    handleError('No media found for this actor.');
                    totalPages = 1;
                    updatePaginationControls(currentPage, totalPages);
                    return;
                }

                const results = data.results.slice(0, 12); // Limit to 12 items
                totalPages = data.total_pages; // Use data.total_pages directly
                displayPopularMedia(results);
                updatePaginationControls(currentPage, totalPages);
            } else {
                handleError('Failed to fetch media for the actor.');
            }
        } catch (error) {
            handleError('An error occurred while fetching media for the actor.', error);
        }
    }

    async function updateMediaDisplay() {
        if (currentMediaType === 'actor' && currentActorId) {
            await fetchMoviesAndShowsByActor(currentActorId, currentPage);
        } else if (currentMediaType === 'search') {
            await search(currentPage);
        } else {
            await fetchPopularMedia(currentPage);
        }
    }

    function clearMediaDisplay() {
        if (popularMedia) {
            popularMedia.innerHTML = '';
        }
    }

    await fetchPopularMedia(currentPage);


    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    async function fetchSelectedMedia(mediaId, mediaType) {
        try {
            const response = await fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}?api_key=${API_KEY}`);
            if (response.ok) {
                const media = await response.json();

                const releaseType = await getReleaseType(mediaId, mediaType);

                const titleSlug = media.title ? media.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : media.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                const newUrl = `${window.location.origin}${window.location.pathname}?title=${encodeURIComponent(titleSlug)}`;
                window.history.pushState({ mediaId, mediaType, title: media.title || media.name }, '', newUrl);

                displaySelectedMedia(media, mediaType, releaseType);
                await fetchMediaTrailer(mediaId, mediaType);

                if (posterImage && media.poster_path) {
                    posterImage.src = `https://image.tmdb.org/t/p/w300${media.poster_path}`;
                    posterImage.alt = media.title || media.name;
                }

                videoPlayerContainer.classList.remove('hidden');
            } else {
                handleError('Failed to fetch media details.', new Error('API response not OK'));
                videoPlayerContainer.classList.add('hidden');
            }
        } catch (error) {
            handleError('An error occurred while fetching media details.', error);
            videoPlayerContainer.classList.add('hidden');
        }
    }

    async function getReleaseType(mediaId, mediaType) {
        try {
            const [releaseDatesResponse, watchProvidersResponse] = await Promise.all([
                fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}/release_dates?api_key=${API_KEY}`),
                fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}/watch/providers?api_key=${API_KEY}`)
            ]);

            // Check if both responses are OK
            if (!releaseDatesResponse.ok || !watchProvidersResponse.ok) {
                throw new Error('Failed to fetch release type or watch providers.');
            }

            // Parse the responses
            const releaseDatesData = await releaseDatesResponse.json();
            const watchProvidersData = await watchProvidersResponse.json();

            const releases = releaseDatesData.results.flatMap(result => result.release_dates);
            const currentDate = new Date();

            const currentUtcDate = new Date(currentDate.toISOString().slice(0, 10)); // Strip time info to only compare dates


            const isDigitalRelease = releases.some(release =>
                (release.type === 4 || release.type === 6) && new Date(release.release_date).getTime() <= currentUtcDate.getTime()
            );

            const theaterRelease = releases.find(release => release.type === 3);
            const isInTheaters = theaterRelease && new Date(theaterRelease.release_date).getTime() <= currentUtcDate.getTime();

            const hasFutureRelease = releases.some(release =>
                new Date(release.release_date).getTime() > currentUtcDate.getTime()
            );

            const streamingRegions = ['US', 'UK', 'CA', 'AU'];
            let isStreamingAvailable = false;
            for (const region of streamingRegions) {
                const providers = watchProvidersData.results?.[region]?.flatrate || [];
                if (providers.length > 0) {
                    isStreamingAvailable = true;
                    break;
                }
            }

            let isRentalOrPurchaseAvailable = false;
            for (const region of streamingRegions) {
                const rentalProviders = watchProvidersData.results?.[region]?.rent || [];
                const buyProviders = watchProvidersData.results?.[region]?.buy || [];
                if (rentalProviders.length > 0 || buyProviders.length > 0) {
                    isRentalOrPurchaseAvailable = true;
                    break;
                }
            }


            if (isStreamingAvailable || isDigitalRelease) {
                return "HD";
            } else if (isInTheaters && !isStreamingAvailable && !isDigitalRelease) {
                return "Cam";
            } else if (hasFutureRelease && !isInTheaters) {
                return "Not Released Yet";
            } else if (isRentalOrPurchaseAvailable) {
                return "Rental/Buy Available";
            }


            return "Unknown Quality";
        } catch (error) {
            console.error('Error occurred while fetching release type:', error);
            return "Unknown Quality";
        }
    }

    async function displayPopularMedia(results) {
        popularMedia.innerHTML = '';

        const mediaWithReleaseType = await Promise.all(results.map(async (media) => {
            const mediaType = media.media_type || (media.title ? 'movie' : 'tv');
            const releaseType = mediaType === 'movie' || mediaType === 'animation' ? await getReleaseType(media.id, mediaType) : '';
            return { ...media, releaseType };
        }));

        mediaWithReleaseType.forEach(media => {
            const mediaCard = document.createElement('div');
            mediaCard.classList.add('media-card');

            const genreNames = media.genre_ids ? media.genre_ids.map(id => genreMap[id] || 'Unknown').join(', ') : 'N/A';
            const formattedDate = media.release_date ? new Date(media.release_date).toLocaleDateString() : (media.first_air_date ? new Date(media.first_air_date).toLocaleDateString() : 'Unknown Date');
            const ratingStars = Array.from({ length: 5 }, (_, i) => i < Math.round(media.vote_average / 2) ? '★' : '☆').join(' ');

            const mediaType = media.media_type || (media.title ? 'movie' : 'tv');
            const displayType = mediaType === 'movie' || mediaType === 'animation' ? media.releaseType : ''; // Include animations if applicable

            mediaCard.innerHTML = `
            <div class="relative w-full h-64 overflow-hidden rounded-lg mb-4">
                <img src="https://image.tmdb.org/t/p/w300${media.poster_path}" alt="${media.title || media.name}" class="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-110">
                <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-50"></div>
                ${displayType ? `<div class="absolute top-0 right-0 m-2 px-2 py-1 bg-black bg-opacity-50 text-white text-xs rounded-lg">${displayType}</div>` : ''}
            </div>
            <div class="flex-grow w-full">
                <h3 class="text-lg font-semibold text-white truncate">${media.title || media.name}</h3>
                <p class="text-gray-400 text-sm mt-2">${mediaType === 'movie' ? '🎬 Movie' : mediaType === 'tv' ? '📺 TV Show' : '📽 Animation'}</p>
                <p class="text-gray-400 text-sm mt-1">Genres: ${genreNames}</p>
                <div class="flex items-center mt-2">
                    <span class="text-yellow-400 text-base">${ratingStars}</span>
                    <span class="text-gray-300 text-sm ml-2">${media.vote_average.toFixed(1)}/10</span>
                </div>
                <p class="text-gray-300 text-sm mt-1">Release Date: ${formattedDate}</p>
            </div>
        `;
            mediaCard.addEventListener('click', function () {
                fetchSelectedMedia(media.id, mediaType);
            });
            popularMedia.appendChild(mediaCard);
        });
    }





    async function fetchMediaTrailer(mediaId, mediaType) {
        try {
            const response = await fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}/videos?api_key=${API_KEY}`);
            if (response.ok) {
                const data = await response.json();
                const trailer = data.results.find(video => video.type === 'Trailer' && video.site === 'YouTube');
                if (trailer) {
                    videoPlayer.src = `https://www.youtube.com/embed/${trailer.key}`;
                } else {
                    videoPlayer.src = '';
                    videoPlayerContainer.classList.add('hidden');
                }
            } else {
                handleError('Failed to fetch media trailer.', new Error('API response not OK'));
                videoPlayerContainer.classList.add('hidden');
            }
        } catch (error) {
            handleError('An error occurred while fetching media trailer.', error);
            videoPlayerContainer.classList.add('hidden');
        }
    }


    async function loadMediaFromUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const title = urlParams.get('title');

        if (title) {
            // Convert the title slug back to a format you can use to fetch media
            const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(title)}`);
            if (response.ok) {
                const data = await response.json();
                const media = data.results.find(item => (item.title && item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') === title) || (item.name && item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === title));
                if (media) {
                    const mediaType = media.media_type || (media.title ? 'movie' : 'tv');
                    await fetchSelectedMedia(media.id, mediaType);
                }
            }
        }
    }


    if (categorySelect) {
        categorySelect.addEventListener('change', function () {
            fetchPopularMedia();
        });
    }

    fetchPopularMedia();
    loadMediaFromUrlParams();
});
