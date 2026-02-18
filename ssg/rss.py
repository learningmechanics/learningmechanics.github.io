"""Generate the RSS feed (feed.xml)."""

from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

from ssg.config import SITE_URL, SITE_TITLE, SITE_DESCRIPTION


def generate_rss(posts, output_dir):
    """Write feed.xml with the 20 most recent posts."""
    rss = Element('rss', version='2.0')
    channel = SubElement(rss, 'channel')

    SubElement(channel, 'title').text = SITE_TITLE
    SubElement(channel, 'link').text = SITE_URL
    SubElement(channel, 'description').text = SITE_DESCRIPTION
    SubElement(channel, 'language').text = 'en-us'

    sorted_posts = sorted(posts, key=lambda p: p.get('date', ''), reverse=True)

    for post in sorted_posts[:20]:
        item = SubElement(channel, 'item')
        SubElement(item, 'title').text = post['title']
        url = f"{SITE_URL}/{post.get('url_path', post['slug'])}"
        SubElement(item, 'link').text = url
        SubElement(item, 'guid').text = url
        if 'description' in post:
            SubElement(item, 'description').text = post['description']
        if 'date' in post:
            try:
                dt = datetime.strptime(post['date'], '%Y-%m-%d')
                SubElement(item, 'pubDate').text = dt.strftime('%a, %d %b %Y 00:00:00 +0000')
            except ValueError:
                pass

    xml_str = minidom.parseString(tostring(rss)).toprettyxml(indent='  ')
    with open(output_dir / 'feed.xml', 'w') as f:
        f.write(xml_str)

    print("✓ Generated feed.xml")
