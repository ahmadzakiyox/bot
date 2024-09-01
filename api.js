const scp = require('@bochilteam/scraper');

const query = 'funny cat videos'; // Contoh query untuk pencarian

async function testYouTubeSearch() {
    try {
        // Menggunakan youtubeSearch untuk mencari video berdasarkan query
        const searchResults = await scp.youtubeSearch(query);

        // Log hasil pencarian untuk melihat bentuk datanya
        console.log('Raw Search Results:', searchResults);

        // Periksa dan tangani struktur data yang berbeda
        if (searchResults && Array.isArray(searchResults)) {
            // Jika searchResults adalah array langsung
            const result = {
                status: true,
                creator: "Ahmadzaki",
                searchResults: searchResults.map(video => ({
                    videoId: video.videoId,
                    url: video.url,
                    title: video.title,
                    thumbnail: video.thumbnail,
                    description: video.description,
                    movingThumbnail: video.movingThumbnail,
                    channelName: video.channelName,
                    channelAvatar: video.channelAvatar,
                    isChannelVerified: video.isChannelVerified,
                    publishedTime: video.publishedTime,
                    viewH: video.viewH,
                    view: video.view,
                    durationH: video.durationH,
                    duration: video.duration
                }))
            };

            // Menampilkan hasil di console untuk testing
            console.log(JSON.stringify(result, null, 2));
        } else {
            throw new Error('Unexpected structure for search results');
        }

    } catch (error) {
        console.error('Error fetching search results:', error);
    }
}

testYouTubeSearch();
