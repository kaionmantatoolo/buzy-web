import { NextRequest, NextResponse } from 'next/server';

const CTB_BASE_URL = 'https://rt.data.gov.hk/v2/transport/citybus';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const targetUrl = `${CTB_BASE_URL}/${path}`;
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
      },
      // Cache for 10 seconds on the edge
      next: { revalidate: 10 },
    });
    
    if (!response.ok) {
      // CTB returns 422 for invalid stop/route combinations - pass through
      if (response.status === 422) {
        return NextResponse.json(
          { type: 'CTB', data: [] },
          { status: 200 }
        );
      }
      
      return NextResponse.json(
        { error: `CTB API error: ${response.status}` },
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
    console.error('CTB proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from CTB API' },
      { status: 500 }
    );
  }
}
