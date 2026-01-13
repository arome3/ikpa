import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

/**
 * Bootstrap the NestJS application
 *
 * Configures:
 * - Security headers (Helmet)
 * - CORS for frontend apps
 * - Global API prefix (/v1)
 * - Validation pipe with transformation
 * - Exception filter for consistent error responses
 * - Transform interceptor for consistent success responses
 * - Swagger documentation
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      // Allow Swagger UI to work properly
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: [
      'https://ikpa.app',
      'https://www.ikpa.app',
      // Development origins
      ...(configService.get('NODE_ENV') === 'development'
        ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:8081']
        : []),
      // Custom CORS origins from environment
      ...(configService.get<string>('CORS_ORIGINS')?.split(',') || []),
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global API prefix
  app.setGlobalPrefix('v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true, // Auto-transform to DTO types
      transformOptions: {
        enableImplicitConversion: true, // Enable type conversion
      },
    }),
  );

  // Global exception filter for consistent error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptor for consistent success responses
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('IKPA API')
    .setDescription(
      'AI-Powered Personal Finance Co-Pilot for Young Africans\n\n' +
        '## Overview\n\n' +
        'Ikpa provides financial clarity, education, and planning tools without touching your money.\n\n' +
        '## Authentication\n\n' +
        'Most endpoints require JWT authentication. Include the token in the Authorization header:\n' +
        '`Authorization: Bearer <token>`\n\n' +
        '## Response Format\n\n' +
        'All responses follow a consistent format:\n' +
        '- Success: `{ success: true, data: {...}, timestamp: "..." }`\n' +
        '- Error: `{ success: false, error: { code: "...", message: "..." }, timestamp: "..." }`',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication and authorization')
    .addTag('Users', 'User profile management')
    .addTag('Income', 'Income source management')
    .addTag('Expenses', 'Expense tracking')
    .addTag('Savings', 'Savings account management')
    .addTag('Goals', 'Financial goal tracking')
    .addTag('AI', 'AI-powered financial insights')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Start server
  const port = configService.get('PORT') || 3000;
  await app.listen(port);

  console.log(`🚀 IKPA API is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/docs`);
}

bootstrap();
