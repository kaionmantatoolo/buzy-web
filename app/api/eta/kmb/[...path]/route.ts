import { NextRequest, NextResponse } from 'next/server';

const KMB_BASE_URL = 'https://data.etabus.gov.hk/v1/transport/kmb';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const targetUrl = `${KMB_BASE_URL}/${path}`;
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
      },
      // Cache for 10 seconds on the edge
      next: { revalidate: 10 },
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `KMB API error: ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=5',
      },
    });
  } catch (error) {
    console.error('KMB proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from KMB API' },
      { status: 500 }
    );
  }
}
