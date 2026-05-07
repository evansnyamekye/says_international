/**
 * Says International School - YouTube Integration
 * Manages YouTube channel display, latest videos, and subscribe functionality
 */

// Configuration - Update CHANNEL_ID once you have the YouTube channel created
window.SAYS_YOUTUBE_CONFIG = {
    CHANNEL_ID: 'UCQXFMdb1AqkEA4F6vrxA9uQ', // Says International School
    CHANNEL_NAME: 'Says International School',
    CHANNEL_URL: 'https://www.youtube.com/@Saysinterschool', // Says International School channel
    MAX_VIDEOS: 4
};

/**
 * Fetch latest videos from YouTube RSS feed
 * Note: This uses YouTube's public RSS feed (no API key needed)
 */
function fetchYouTubeLatestVideos(channelId, maxResults = 4) {
    // Channel ID is now configured
    if (!channelId || channelId === '') {
        console.warn('YouTube channel ID is empty. Cannot fetch videos.');
        return Promise.resolve([]);
    }
    
    // YouTube RSS feed URL (works without authentication)
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    
    // Use CORS proxy or direct fetch with proper headers
    return fetch(rssUrl)
        .then(response => response.text())
        .then(xml => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xml, 'text/xml');
            
            if (xmlDoc.getElementsByTagName('parsererror').length) {
                console.error('Failed to parse YouTube RSS feed');
                return [];
            }
            
            const entries = xmlDoc.getElementsByTagName('entry');
            const videos = [];
            
            for (let i = 0; i < Math.min(entries.length, maxResults); i++) {
                const entry = entries[i];
                const title = entry.getElementsByTagName('title')[0]?.textContent || 'Untitled';
                const videoId = entry.getElementsByTagName('yt:videoId')[0]?.textContent || '';
                const published = entry.getElementsByTagName('published')[0]?.textContent || '';
                const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                
                // Parse published date
                const pubDate = new Date(published);
                const formattedDate = pubDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                videos.push({
                    id: videoId,
                    title: title,
                    thumbnail: thumbnail,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    published: published,
                    formattedDate: formattedDate
                });
            }
            
            return videos;
        })
        .catch(error => {
            console.error('Error fetching YouTube videos:', error);
            return [];
        });
}

/**
 * Render latest videos section
 */
function renderYouTubeLatestVideos(videos) {
    const container = document.getElementById('says-youtube-latest-videos');
    if (!container || videos.length === 0) {
        return;
    }
    
    let html = '';
    videos.forEach(video => {
        html += `
            <div class="says-youtube-video-card">
                <div class="says-youtube-video-thumbnail">
                    <a href="${video.url}" target="_blank" rel="noopener noreferrer" class="says-youtube-video-link">
                        <img src="${video.thumbnail}" alt="${video.title}" />
                        <div class="says-youtube-play-icon">
                            <i class="fa fa-play"></i>
                        </div>
                    </a>
                </div>
                <div class="says-youtube-video-info">
                    <h4 class="says-youtube-video-title">
                        <a href="${video.url}" target="_blank" rel="noopener noreferrer">${video.title}</a>
                    </h4>
                    <p class="says-youtube-video-date">${video.formattedDate}</p>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Initialize YouTube integration when page loads
 */
function initializeYouTubeIntegration() {
    const config = window.SAYS_YOUTUBE_CONFIG;
    
    // Only fetch videos if channel ID is configured
    if (config.CHANNEL_ID !== 'UCYourChannelIDHere') {
        fetchYouTubeLatestVideos(config.CHANNEL_ID, config.MAX_VIDEOS)
            .then(videos => {
                renderYouTubeLatestVideos(videos);
            });
    } else {
        // Show placeholder if channel not yet configured
        const container = document.getElementById('says-youtube-latest-videos');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #666;">
                    <p>YouTube channel coming soon! Subscribe to stay updated on our latest videos.</p>
                </div>
            `;
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeYouTubeIntegration);
} else {
    initializeYouTubeIntegration();
}
