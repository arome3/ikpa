/**
 * Share Page Controller
 *
 * Public endpoint for viewing shared story cards.
 * Returns card data with OG meta tags for social media previews.
 *
 * This endpoint is PUBLIC - no authentication required.
 * Rate limited to prevent abuse.
 */

import {
  Controller,
  Get,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { isIP } from 'net';
import { Public } from '../../common/decorators';
import { StoryCardsService } from './story-cards.service';
import { SharePageResponseDto } from './dto';
import { STORY_CARD_RATE_LIMITS } from './constants';

/**
 * Extract and validate IP address from request
 *
 * SECURITY: Properly handles X-Forwarded-For header and validates IP format.
 *
 * @param request - Express request object
 * @returns Valid IP address or undefined if invalid/missing
 */
function extractAndValidateIp(request: Request): string | undefined {
  // Get X-Forwarded-For header (may be string or string array)
  const forwardedFor = request.headers['x-forwarded-for'];

  let rawIp: string | undefined;

  if (forwardedFor) {
    // X-Forwarded-For can be comma-separated list of IPs
    // The first IP is the original client IP
    if (Array.isArray(forwardedFor)) {
      // Header appeared multiple times - take first IP from first header
      rawIp = forwardedFor[0]?.split(',')[0]?.trim();
    } else {
      // Single header value - take first IP from comma-separated list
      rawIp = forwardedFor.split(',')[0]?.trim();
    }
  } else {
    // Fall back to request.ip
    rawIp = request.ip;
  }

  // If no IP found, return undefined
  if (!rawIp) {
    return undefined;
  }

  // Validate IP format using Node's built-in isIP function
  // Returns 0 for invalid, 4 for IPv4, 6 for IPv6
  const ipVersion = isIP(rawIp);

  if (ipVersion === 0) {
    // Invalid IP format - return undefined instead of passing through
    return undefined;
  }

  return rawIp;
}

/**
 * Public controller for share pages
 *
 * Endpoint:
 * - GET /share/:code - Public share page with OG meta tags
 */
@ApiTags('Share Pages')
@Controller('share')
export class SharePageController {
  constructor(private readonly storyCardsService: StoryCardsService) {}

  /**
   * Get public share page data
   *
   * Returns card content with OG meta tags for social media previews.
   * Increments view count automatically.
   * No authentication required.
   */
  @Get(':code')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: STORY_CARD_RATE_LIMITS.PUBLIC_VIEW.limit,
      ttl: STORY_CARD_RATE_LIMITS.PUBLIC_VIEW.ttl,
    },
  })
  @ApiOperation({
    summary: 'Get public share page',
    description:
      'Retrieve public story card data for rendering a share page. ' +
      'Includes OG meta tags for social media previews. ' +
      'No authentication required. View count is automatically incremented.',
  })
  @ApiParam({
    name: 'code',
    description: 'Share code from the share URL',
    example: 'abc12345def6',
  })
  @ApiResponse({
    status: 200,
    description: 'Share page data retrieved successfully',
    type: SharePageResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Story card not found',
  })
  @ApiResponse({
    status: 410,
    description: 'Story card has expired',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async getSharePage(
    @Param('code') code: string,
    @Req() request: Request,
  ): Promise<SharePageResponseDto> {
    // SECURITY: Extract and validate IP address for view abuse detection
    // Uses helper function that handles X-Forwarded-For properly and validates IP format
    const ipAddress = extractAndValidateIp(request);

    return this.storyCardsService.getPublicCard(code, ipAddress);
  }
}
