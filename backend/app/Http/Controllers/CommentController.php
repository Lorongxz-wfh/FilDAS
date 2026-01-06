<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Document;
use Illuminate\Http\Request;
use App\Helpers\ActivityLogger;

class CommentController extends Controller
{
    public function indexForDocument(Request $request, Document $document)
    {
        $comments = $document->comments()
            ->with('user:id,name,email')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function (Comment $c) {
                return [
                    'id'         => $c->id,
                    'body'       => $c->body,
                    'user'       => $c->user ? [
                        'id'    => $c->user->id,
                        'name'  => $c->user->name,
                        'email' => $c->user->email,
                    ] : null,
                    'created_at' => $c->created_at,
                ];
            });

        return response()->json($comments);
    }

    public function storeForDocument(Request $request, Document $document)
    {
        $user = $request->user();

        $data = $request->validate([
            'body' => 'required|string|max:5000',
        ]);

        // TODO: later tighten permissions based on QA / uploader / dept admin
        $comment = Comment::create([
            'commentable_type' => Document::class,
            'commentable_id'   => $document->id,
            'user_id'          => $user->id,
            'body'             => $data['body'],
        ]);

        $comment->load('user:id,name,email');

        // Log comment added on the document
        ActivityLogger::log(
            $document,
            'comment_added',
            'Comment added by ' . ($comment->user->name ?? 'Unknown'),
            $user->id
        );

        return response()->json([
            'id'         => $comment->id,
            'body'       => $comment->body,
            'user'       => [
                'id'    => $comment->user->id,
                'name'  => $comment->user->name,
                'email' => $comment->user->email,
            ],
            'created_at' => $comment->created_at,
        ], 201);
    }
}
