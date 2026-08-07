<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthenticationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;

class AuthController extends Controller
{
    public function __construct(private readonly AuthenticationService $authentication) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $user = $this->authentication->login(
            $request,
            $request->string('email')->value(),
            $request->string('password')->value(),
            $request->boolean('remember'),
        );

        if ($user === null) {
            return response()->json(['message' => 'The provided credentials are incorrect.'], 422);
        }

        return response()->json([
            'message' => 'Authenticated successfully.',
            'data' => new UserResource($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->authentication->logout($request);

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $this->authentication->sendPasswordResetLink($request->string('email')->value());

        return response()->json([
            'message' => 'If an account exists for this email address, a password reset link has been sent.',
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = $this->authentication->resetPassword($request->safe()->only([
            'email', 'password', 'password_confirmation', 'token',
        ]));

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['message' => __($status)], 422);
        }

        return response()->json(['message' => 'Password reset successfully.']);
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $this->authentication->changePassword(
            $request,
            $request->user(),
            $request->string('password')->value(),
        );

        return response()->json(['message' => 'Password changed successfully.']);
    }
}
