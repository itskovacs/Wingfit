import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { UtilsService } from './utils.service';

export interface Token {
  refresh_token: string;
  access_token: string;
}

const JWT_TOKEN = 'WINGFIT_AT';
const REFRESH_TOKEN = 'WINGFIT_RT';
const JWT_EXPIRE = 'WINGFIT_ATT';
const JWT_USER = 'WINGFIT_USER';

@Injectable({ providedIn: 'root' })
export class AuthService {
  public apiBaseUrl: string;

  constructor(
    private httpClient: HttpClient,
    private router: Router,
    private apiService: ApiService,
    private utilsService: UtilsService,
  ) {
    this.apiBaseUrl = this.apiService.apiBaseUrl;
  }

  set loggedUser(user: string) {
    localStorage.setItem(JWT_USER, user);
  }

  get loggedUser(): string {
    return localStorage.getItem(JWT_USER) ?? '';
  }

  set accessToken(token: string) {
    localStorage.setItem(JWT_TOKEN, token);
  }

  get accessToken(): string {
    return localStorage.getItem(JWT_TOKEN) ?? '';
  }

  set accessTokenExp(date: number) {
    localStorage.setItem(JWT_EXPIRE, date.toString());
  }

  get accessTokenExp(): string {
    return localStorage.getItem(JWT_EXPIRE) ?? '';
  }

  set refreshToken(token: string) {
    localStorage.setItem(REFRESH_TOKEN, token);
  }

  get refreshToken(): string {
    return localStorage.getItem(REFRESH_TOKEN) ?? '';
  }

  storeTokens(tokens: Token): void {
    this.accessToken = tokens.access_token;
    this.accessTokenExp =
      this._getTokenExpirationDate(tokens.access_token)?.valueOf() ?? -1;
    this.refreshToken = tokens.refresh_token;
  }

  isLoggedIn(): Observable<boolean> {
    if (this.loggedUser) return of(true);

    if (this.accessToken) return of(true);

    return of(false);
  }

  refreshAccessToken(): Observable<Token> {
    return this.httpClient
      .post<Token>(this.apiBaseUrl + '/auth/refresh', {
        refresh_token: this.refreshToken,
      })
      .pipe(
        tap((tokens: Token) => {
          if (tokens) this.storeTokens(tokens);
        }),
      );
  }

  login(authForm: { username: string; password: string }): Observable<Token> {
    return this.httpClient
      .post<Token>(this.apiBaseUrl + '/auth/login', authForm)
      .pipe(
        tap((tokens: Token) => {
          this.loggedUser = authForm.username;
          this.storeTokens(tokens);
        }),
      );
  }

  register(authForm: {
    username: string;
    password: string;
  }): Observable<Token> {
    return this.httpClient
      .post<Token>(this.apiBaseUrl + '/auth/register', authForm)
      .pipe(
        tap((tokens: Token) => {
          this.loggedUser = authForm.username;
          this.storeTokens(tokens);
        }),
      );
  }

  logout(custom_msg: string = '', is_error = false): void {
    this.loggedUser = '';
    this.removeTokens();

    if (custom_msg) {
      if (is_error) {
        this.utilsService.toast(
          'error',
          'You must be authenticated',
          custom_msg,
        );
      } else {
        this.utilsService.toast('success', 'Success', custom_msg);
      }
    }

    this.router.navigate(['/auth']);
  }

  private removeTokens(): void {
    localStorage.removeItem(JWT_TOKEN);
    localStorage.removeItem(JWT_EXPIRE);
    localStorage.removeItem(REFRESH_TOKEN);
    localStorage.removeItem(JWT_USER);
  }

  isTokenExpired(token: string, offsetSeconds?: number): boolean {
    // Return if there is no token
    if (!token || token === '') {
      return true;
    }

    // Get the expiration date
    const date = this._getTokenExpirationDate(token);
    offsetSeconds = offsetSeconds || 0;

    if (date === null) {
      return true;
    }

    // Check if the token is expired
    return !(date.valueOf() > new Date().valueOf() + offsetSeconds * 1000);
  }

  private _b64DecodeUnicode(str: any): string {
    return decodeURIComponent(
      Array.prototype.map
        .call(
          this._b64decode(str),
          (c: any) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2),
        )
        .join(''),
    );
  }

  private _b64decode(str: string): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';

    str = String(str).replace(/=+$/, '');

    if (str.length % 4 === 1) {
      throw new Error(
        "'atob' failed: The string to be decoded is not correctly encoded.",
      );
    }

    /* eslint-disable */
    for (
      let bc = 0, bs: any, buffer: any, idx = 0;
      (buffer = str.charAt(idx++));
      ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
        ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0
    ) {
      buffer = chars.indexOf(buffer);
    }
    /* eslint-enable */

    return output;
  }

  private _urlBase64Decode(str: string): string {
    let output = str.replace(/-/g, '+').replace(/_/g, '/');
    switch (output.length % 4) {
      case 0: {
        break;
      }
      case 2: {
        output += '==';
        break;
      }
      case 3: {
        output += '=';
        break;
      }
      default: {
        throw Error('Illegal base64url string!');
      }
    }
    return this._b64DecodeUnicode(output);
  }

  private _decodeToken(token: string): any {
    if (!token) {
      return null;
    }

    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    const decoded = this._urlBase64Decode(parts[1]);

    if (!decoded) {
      return null;
    }

    return JSON.parse(decoded);
  }

  private _getTokenExpirationDate(token: string): Date | null {
    const decodedToken = this._decodeToken(token);

    if (decodedToken === null) {
      return null;
    }

    if (!decodedToken.hasOwnProperty('exp')) {
      return null;
    }

    const date = new Date(0);
    date.setUTCSeconds(decodedToken.exp);

    return date;
  }
}
